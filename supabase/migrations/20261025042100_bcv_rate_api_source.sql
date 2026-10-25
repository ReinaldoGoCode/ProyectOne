-- Supabase Edge Runtime cannot validate the certificate chain currently served
-- by bcv.org.ve (UnknownIssuer). Use the no-key DolarVZLA BCV mirror, whose
-- rate/date were compared against the official BCV site on 2026-10-25.
-- Keep provenance explicit in rate quotes and order snapshots.

alter table public.bcv_rate_cache
  drop constraint bcv_rate_cache_check;

alter table public.bcv_rate_cache
  add constraint bcv_rate_cache_valid_source_check
  check (
    (ves_per_usd is null and effective_date is null and retrieved_at is null and source_url is null)
    or
    (ves_per_usd is not null and effective_date is not null and retrieved_at is not null
      and source_url in (
        'https://www.bcv.org.ve/',
        'https://rates.dolarvzla.com/bcv/current.json'
      ))
  );

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
      source_url = 'https://rates.dolarvzla.com/bcv/current.json',
      last_error_code = null,
      next_attempt_at = now() + interval '55 minutes'
  where id = true;
end;
$$;

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
    and source_url = cache_row.source_url
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
    or quote_row.source_url not in (
      'https://www.bcv.org.ve/',
      'https://rates.dolarvzla.com/bcv/current.json'
    ) then
    raise exception 'A dated BCV rate is required to create a new order.' using errcode = 'P0003';
  end if;
  new.exchange_rate_effective_date := quote_row.effective_date;
  new.exchange_rate_source_url := quote_row.source_url;
  new.exchange_rate_retrieved_at := quote_row.retrieved_at;
  return new;
end;
$$;
