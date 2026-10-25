alter table public.exchange_quotes
  add column effective_date date,
  add column source_url text,
  add column retrieved_at timestamptz;

alter table public.orders
  add column exchange_rate_effective_date date,
  add column exchange_rate_source_url text,
  add column exchange_rate_retrieved_at timestamptz;

create table public.bcv_rate_cache (
  id boolean primary key default true check (id),
  ves_per_usd numeric(16, 6) check (ves_per_usd is null or ves_per_usd > 0),
  effective_date date,
  retrieved_at timestamptz,
  source_url text,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error_code text check (last_error_code in (
    'upstream_unavailable', 'invalid_upstream_data', 'stale_source', 'database_write_failed'
  )),
  check (
    (ves_per_usd is null and effective_date is null and retrieved_at is null and source_url is null)
    or
    (ves_per_usd is not null and effective_date is not null and retrieved_at is not null
      and source_url = 'https://www.bcv.org.ve/')
  )
);

insert into public.bcv_rate_cache (id) values (true) on conflict (id) do nothing;

update public.payment_methods
set public_instructions = E'Pago Móvil\nBanco: Banco Venezolano de Crédito\nCédula o RIF: V-14082115\nTeléfono: 0412-3095646\nUsa únicamente el total en bolívares mostrado en el checkout y revisa la fecha de vigencia de la tasa BCV antes de transferir.'
where method = 'pago_movil';

alter table public.bcv_rate_cache enable row level security;
revoke all on public.bcv_rate_cache from public, anon, authenticated;
grant all on public.bcv_rate_cache to service_role;

create or replace function public.claim_bcv_rate_refresh()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bcv_rate_cache
  set last_attempt_at = now(), next_attempt_at = now() + interval '55 minutes'
  where id = true and next_attempt_at <= now();
  return found;
end;
$$;

create or replace function public.save_bcv_rate(
  p_ves_per_usd numeric,
  p_effective_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cache_row public.bcv_rate_cache;
  caracas_today date := (now() at time zone 'America/Caracas')::date;
begin
  if p_ves_per_usd is null or p_ves_per_usd <= 0 or p_ves_per_usd > 10000000
    or p_effective_date is null
    or p_effective_date > caracas_today + 4
    or p_effective_date < caracas_today - 3 then
    raise exception 'BCV rate failed freshness or value validation.' using errcode = '22023';
  end if;

  select * into cache_row from public.bcv_rate_cache where id = true for update;
  if cache_row.effective_date is not null and p_effective_date < cache_row.effective_date then
    raise exception 'BCV source returned an older effective date.' using errcode = '22023';
  end if;

  update public.bcv_rate_cache
  set ves_per_usd = round(p_ves_per_usd, 6),
      effective_date = p_effective_date,
      retrieved_at = now(),
      source_url = 'https://www.bcv.org.ve/',
      last_error_code = null,
      next_attempt_at = now() + interval '55 minutes'
  where id = true;
end;
$$;

create or replace function public.record_bcv_rate_failure(p_error_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_error_code not in (
    'upstream_unavailable', 'invalid_upstream_data', 'stale_source', 'database_write_failed'
  ) then
    raise exception 'Invalid BCV refresh error code.' using errcode = '22023';
  end if;
  update public.bcv_rate_cache
  set last_error_code = p_error_code,
      next_attempt_at = now() + interval '55 minutes'
  where id = true;
end;
$$;

revoke execute on function public.claim_bcv_rate_refresh() from public, anon, authenticated;
revoke execute on function public.save_bcv_rate(numeric, date) from public, anon, authenticated;
revoke execute on function public.record_bcv_rate_failure(text) from public, anon, authenticated;
grant execute on function public.claim_bcv_rate_refresh() to service_role;
grant execute on function public.save_bcv_rate(numeric, date) to service_role;
grant execute on function public.record_bcv_rate_failure(text) to service_role;

create or replace function public.issue_bcv_quote()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cache_row public.bcv_rate_cache;
  quote_row public.exchange_quotes;
  caracas_today date := (now() at time zone 'America/Caracas')::date;
begin
  select * into cache_row from public.bcv_rate_cache where id = true for share;
  if not found or cache_row.ves_per_usd is null then
    raise exception 'No validated BCV rate is available.' using errcode = 'P0003';
  end if;
  if cache_row.effective_date < caracas_today - 3
    or cache_row.retrieved_at < now() - interval '96 hours' then
    raise exception 'The last BCV rate is too old for a new order.' using errcode = 'P0003';
  end if;

  select * into quote_row from public.exchange_quotes
  where source = 'bcv'
    and ves_per_usd = cache_row.ves_per_usd
    and effective_date = cache_row.effective_date
    and expires_at > now()
  order by quoted_at desc limit 1;

  if not found then
    insert into public.exchange_quotes (
      ves_per_usd, source, quoted_at, expires_at, effective_date, source_url, retrieved_at
    ) values (
      cache_row.ves_per_usd, 'bcv', now(), now() + interval '15 minutes',
      cache_row.effective_date, cache_row.source_url, cache_row.retrieved_at
    ) returning * into quote_row;
  end if;

  return jsonb_build_object(
    'id', quote_row.id,
    'vesPerUsd', quote_row.ves_per_usd::text,
    'source', quote_row.source,
    'quotedAt', quote_row.quoted_at,
    'expiresAt', quote_row.expires_at,
    'effectiveDate', quote_row.effective_date,
    'sourceUrl', quote_row.source_url,
    'retrievedAt', quote_row.retrieved_at,
    'rateWarning', cache_row.last_error_code is not null
  );
end;
$$;

revoke execute on function public.issue_bcv_quote() from public, anon, authenticated;
grant execute on function public.issue_bcv_quote() to service_role;

-- Keep the old RPC name temporarily for deployed Edge Function versions; it
-- now delegates to the dated BCV quote and can no longer create a demo rate.
create or replace function public.issue_demo_quote()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.issue_bcv_quote();
$$;
revoke execute on function public.issue_demo_quote() from public, anon, authenticated;
grant execute on function public.issue_demo_quote() to service_role;

create or replace function public.snapshot_order_exchange_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quote_row public.exchange_quotes;
begin
  select * into quote_row from public.exchange_quotes where id = new.exchange_quote_id;
  if not found or quote_row.source <> 'bcv' or quote_row.effective_date is null
    or quote_row.source_url <> 'https://www.bcv.org.ve/' then
    raise exception 'A dated BCV rate is required to create a new order.' using errcode = 'P0003';
  end if;
  new.exchange_rate_effective_date := quote_row.effective_date;
  new.exchange_rate_source_url := quote_row.source_url;
  new.exchange_rate_retrieved_at := quote_row.retrieved_at;
  return new;
end;
$$;

create trigger orders_snapshot_exchange_rate
before insert on public.orders
for each row execute function public.snapshot_order_exchange_rate();

create or replace function public.lookup_public_order(p_code text, p_tracking_token_hash text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'createdAt', o.created_at, 'customer', o.customer,
    'deliveryMethod', o.delivery_method, 'shippingAddress', o.shipping_address,
    'shippingAgency', o.shipping_agency, 'shippingCompany', o.shipping_company,
    'shippingTrackingNumber', o.shipping_tracking_number, 'shippingNotes', o.shipping_notes,
    'paymentMethod', o.payment_method, 'paymentInstructions', o.payment_instructions,
    'paymentReference', (
      select pa.reference from public.payment_attempts pa
      where pa.order_id = o.id and pa.reference is not null
      order by pa.created_at desc limit 1
    ),
    'customerNote', o.customer_note,
    'currency', o.currency, 'vesCurrency', 'VES',
    'subtotalCents', o.subtotal_cents, 'shippingCents', o.shipping_cents,
    'totalCents', o.total_cents, 'vesPerUsd', o.ves_per_usd::text,
    'vesTotalCents', o.ves_total_cents,
    'orderStatus', o.order_status, 'paymentStatus', o.payment_status,
    'fulfillmentStatus', o.fulfillment_status,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'productId', i.product_id, 'productName', i.product_name,
        'variantId', i.variant_id, 'size', i.size, 'color', i.color,
        'unitPriceCents', i.unit_price_cents, 'quantity', i.quantity
      ) order by i.id)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb),
    'notes', '[]'::jsonb,
    'exchangeQuote', jsonb_build_object(
      'vesPerUsd', o.ves_per_usd::text, 'source', q.source,
      'quotedAt', q.quoted_at, 'expiresAt', q.expires_at,
      'effectiveDate', o.exchange_rate_effective_date,
      'sourceUrl', o.exchange_rate_source_url,
      'retrievedAt', o.exchange_rate_retrieved_at
    ),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'axis', e.axis, 'from', e.from_status,
        'to', e.to_status, 'at', e.created_at, 'note', e.note
      ) order by e.created_at, e.id)
      from public.audit_events e where e.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o join public.exchange_quotes q on q.id = o.exchange_quote_id
  where upper(o.code) = upper(trim(p_code)) and o.tracking_token_hash = p_tracking_token_hash;
$$;

revoke execute on function public.lookup_public_order(text, text) from public, anon, authenticated;
grant execute on function public.lookup_public_order(text, text) to service_role;

-- Supabase Cloud only: schedule one cached refresh per hour. The endpoint is
-- read-only apart from a rate-limited cache update and accepts no customer data.
-- BEGIN SUPABASE CLOUD ONLY
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret(
  'https://ctnpisuizfhxcuxrjhah.supabase.co',
  'norte_moda_supabase_url',
  'Norte Moda public project URL used only by the hourly BCV rate refresh job'
)
where not exists (
  select 1 from vault.decrypted_secrets where name = 'norte_moda_supabase_url'
);

select cron.unschedule(jobid)
from cron.job where jobname = 'norte-moda-refresh-bcv-rate-hourly';

select cron.schedule(
  'norte-moda-refresh-bcv-rate-hourly',
  '0 * * * *',
  $$
    select net.http_get(
      url := (select decrypted_secret from vault.decrypted_secrets
              where name = 'norte_moda_supabase_url') || '/functions/v1/exchange-rate',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 10000
    );
  $$
);
-- END SUPABASE CLOUD ONLY
