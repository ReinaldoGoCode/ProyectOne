alter table public.orders
  add column whatsapp_opt_in boolean not null default false,
  add column whatsapp_opt_in_at timestamptz,
  add constraint orders_whatsapp_opt_in_recorded_check
    check ((whatsapp_opt_in and whatsapp_opt_in_at is not null) or (not whatsapp_opt_in and whatsapp_opt_in_at is null));

alter table public.whatsapp_webhook_events
  add column processing_status text not null default 'completed'
    check (processing_status in ('processing', 'completed', 'failed')),
  add column attempt_count integer not null default 0 check (attempt_count >= 0),
  add column lease_expires_at timestamptz,
  add column completed_at timestamptz,
  add column last_error_code text;

create table public.whatsapp_conversations (
  sender_hash text primary key check (sender_hash ~ '^[0-9a-f]{64}$'),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  last_inbound_at timestamptz not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  check (expires_at <= last_inbound_at + interval '24 hours')
);

create index whatsapp_conversations_expiry_idx on public.whatsapp_conversations (expires_at);

create table public.whatsapp_opt_outs (
  sender_hash text primary key check (sender_hash ~ '^[0-9a-f]{64}$'),
  opted_out_at timestamptz not null default now(),
  source_event_id text not null unique
);

create table public.whatsapp_consent_events (
  id uuid primary key default gen_random_uuid(),
  sender_hash text not null check (sender_hash ~ '^[0-9a-f]{64}$'),
  order_id uuid references public.orders(id) on delete set null,
  event_type text not null check (event_type in ('granted', 'revoked')),
  consent_version text,
  created_at timestamptz not null default now()
);

create table public.whatsapp_order_followups (
  order_id uuid primary key references public.orders(id) on delete cascade,
  sender_hash text not null check (sender_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  lease_expires_at timestamptz,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_order_followups_pending_idx
  on public.whatsapp_order_followups (status, updated_at)
  where status in ('pending', 'failed');

create table public.whatsapp_outbound_messages (
  provider_event_id text primary key,
  recipient_phone text not null check (recipient_phone ~ '^[0-9]{8,15}$'),
  recipient_hash text not null check (recipient_hash ~ '^[0-9a-f]{64}$'),
  body text not null check (length(body) between 1 and 2000),
  window_expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  lease_expires_at timestamptz,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_outbound_pending_idx
  on public.whatsapp_outbound_messages (status, updated_at)
  where status in ('pending', 'failed');

create table public.whatsapp_delivery_receipts (
  provider_message_id text primary key check (length(provider_message_id) between 4 and 255),
  status text not null check (status in ('sent', 'delivered', 'read', 'failed')),
  event_at timestamptz not null,
  error_code text,
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_opt_outs enable row level security;
alter table public.whatsapp_consent_events enable row level security;
alter table public.whatsapp_order_followups enable row level security;
alter table public.whatsapp_outbound_messages enable row level security;
alter table public.whatsapp_delivery_receipts enable row level security;

revoke all on public.whatsapp_conversations, public.whatsapp_opt_outs,
  public.whatsapp_consent_events, public.whatsapp_order_followups,
  public.whatsapp_outbound_messages, public.whatsapp_delivery_receipts from public, anon, authenticated;
grant all on public.whatsapp_conversations, public.whatsapp_opt_outs,
  public.whatsapp_consent_events, public.whatsapp_order_followups,
  public.whatsapp_outbound_messages, public.whatsapp_delivery_receipts to service_role;

alter table public.whatsapp_handoffs drop constraint if exists whatsapp_handoffs_reason_check;
alter table public.whatsapp_handoffs add constraint whatsapp_handoffs_reason_check
  check (reason in (
    'human_requested', 'payment_instructions_missing', 'unknown_request',
    'payment_reference_submitted', 'shipping_exception', 'stock_exception'
  ));

create or replace function public.claim_whatsapp_webhook_event(p_provider_event_id text, p_event_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean := false;
begin
  with expired as (
    select provider_event_id from public.whatsapp_webhook_events
    where processing_status = 'completed' and completed_at < now() - interval '30 days'
    order by completed_at limit 200
  )
  delete from public.whatsapp_webhook_events e using expired x where e.provider_event_id = x.provider_event_id;
  if p_provider_event_id is null or length(p_provider_event_id) < 4 or length(p_provider_event_id) > 255
    or p_event_type is null or length(p_event_type) < 1 or length(p_event_type) > 80 then
    raise exception 'Invalid WhatsApp webhook event.' using errcode = '22023';
  end if;
  insert into public.whatsapp_webhook_events (
    provider_event_id, event_type, processing_status, attempt_count, lease_expires_at
  ) values (p_provider_event_id, p_event_type, 'processing', 1, now() + interval '3 minutes')
  on conflict (provider_event_id) do update set
    event_type = excluded.event_type,
    processing_status = 'processing',
    attempt_count = public.whatsapp_webhook_events.attempt_count + 1,
    lease_expires_at = now() + interval '3 minutes',
    completed_at = null,
    last_error_code = null
  where public.whatsapp_webhook_events.processing_status = 'failed'
    or (public.whatsapp_webhook_events.processing_status = 'processing'
      and public.whatsapp_webhook_events.lease_expires_at < now())
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

create or replace function public.complete_whatsapp_webhook_event(p_provider_event_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.whatsapp_webhook_events set
    processing_status = 'completed', completed_at = now(), lease_expires_at = null
    where provider_event_id = p_provider_event_id and processing_status = 'processing';
  return found;
end;
$$;

create or replace function public.fail_whatsapp_webhook_event(p_provider_event_id text, p_error_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.whatsapp_webhook_events set
    processing_status = 'failed', lease_expires_at = null,
    last_error_code = left(regexp_replace(coalesce(p_error_code, 'processing_failed'), '[^a-zA-Z0-9_-]', '', 'g'), 80)
    where provider_event_id = p_provider_event_id and processing_status = 'processing';
  return found;
end;
$$;

create or replace function public.get_whatsapp_conversation(p_sender_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_sender_hash is null or p_sender_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid WhatsApp conversation key.' using errcode = '22023';
  end if;
  select context into result from public.whatsapp_conversations
    where sender_hash = p_sender_hash and expires_at > now();
  return result;
end;
$$;

create or replace function public.save_whatsapp_conversation(
  p_sender_hash text,
  p_context jsonb,
  p_last_inbound_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_keys text[] := array[
    'productSlug', 'size', 'color', 'quantity', 'orderCode', 'preferenceCategory',
    'preferenceSize', 'preferenceColor', 'awaitingPaymentReference'
  ];
begin
  if p_sender_hash is null or p_sender_hash !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_context) is distinct from 'object'
    or length(p_context::text) > 2048
    or p_context - allowed_keys <> '{}'::jsonb
    or p_last_inbound_at is null or p_last_inbound_at > now() + interval '5 minutes'
    or p_last_inbound_at < now() - interval '7 days' then
    raise exception 'Invalid WhatsApp conversation state.' using errcode = '22023';
  end if;
  if (p_context ? 'productSlug' and jsonb_typeof(p_context->'productSlug') not in ('string', 'null'))
    or (p_context ? 'size' and jsonb_typeof(p_context->'size') not in ('string', 'null'))
    or (p_context ? 'color' and jsonb_typeof(p_context->'color') not in ('string', 'null'))
    or (p_context ? 'quantity' and jsonb_typeof(p_context->'quantity') not in ('number', 'null'))
    or (p_context ? 'orderCode' and jsonb_typeof(p_context->'orderCode') not in ('string', 'null'))
    or (p_context ? 'awaitingPaymentReference' and jsonb_typeof(p_context->'awaitingPaymentReference') <> 'boolean') then
    raise exception 'Invalid WhatsApp conversation values.' using errcode = '22023';
  end if;
  with expired as (
    select sender_hash from public.whatsapp_conversations
    where expires_at < now() order by expires_at limit 200
  )
  delete from public.whatsapp_conversations c using expired x where c.sender_hash = x.sender_hash;
  insert into public.whatsapp_conversations (sender_hash, context, last_inbound_at, expires_at, updated_at)
    values (p_sender_hash, p_context, p_last_inbound_at, p_last_inbound_at + interval '24 hours', now())
  on conflict (sender_hash) do update set
    context = excluded.context,
    last_inbound_at = excluded.last_inbound_at,
    expires_at = excluded.expires_at,
    updated_at = now()
  where excluded.last_inbound_at >= public.whatsapp_conversations.last_inbound_at;
  return true;
end;
$$;

create or replace function public.record_whatsapp_opt_out(p_sender_hash text, p_provider_event_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_sender_hash is null or p_sender_hash !~ '^[0-9a-f]{64}$'
    or p_provider_event_id is null or length(p_provider_event_id) < 4 or length(p_provider_event_id) > 255 then
    raise exception 'Invalid WhatsApp opt-out.' using errcode = '22023';
  end if;
  insert into public.whatsapp_opt_outs (sender_hash, source_event_id)
    values (p_sender_hash, p_provider_event_id)
  on conflict (sender_hash) do update set opted_out_at = now(), source_event_id = excluded.source_event_id;
  delete from public.whatsapp_conversations where sender_hash = p_sender_hash;
  update public.whatsapp_outbound_messages set status = 'failed',
    attempt_count = 5, last_error_code = 'recipient_opted_out', lease_expires_at = null, updated_at = now()
    where recipient_hash = p_sender_hash and status in ('pending', 'failed');
  update public.whatsapp_order_followups set status = 'failed', attempt_count = 5,
    last_error_code = 'recipient_opted_out', lease_expires_at = null, updated_at = now()
    where sender_hash = p_sender_hash and status in ('pending', 'failed');
  insert into public.whatsapp_consent_events (sender_hash, order_id, event_type, consent_version)
    values (p_sender_hash, null, 'revoked', 'whatsapp-stop-v1');
  return true;
end;
$$;

create or replace function public.is_whatsapp_opted_out(p_sender_hash text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (select 1 from public.whatsapp_opt_outs where sender_hash = p_sender_hash);
$$;

create or replace function public.is_whatsapp_handoff_active(p_sender_phone text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.whatsapp_handoffs
    where sender_phone = p_sender_phone and status in ('open', 'claimed')
  );
$$;

create or replace function public.create_whatsapp_handoff(
  p_provider_event_id text,
  p_sender_phone text,
  p_order_code text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  if p_provider_event_id is null or length(p_provider_event_id) < 4 or length(p_provider_event_id) > 255
    or p_sender_phone is null or p_sender_phone !~ '^[0-9]{8,15}$'
    or p_reason is null
    or p_reason not in (
      'human_requested', 'payment_instructions_missing', 'unknown_request',
      'payment_reference_submitted', 'shipping_exception', 'stock_exception'
    )
    or (p_order_code is not null and p_order_code !~* '^NM-[0-9]{3,}$') then
    raise exception 'Invalid WhatsApp handoff.' using errcode = '22023';
  end if;
  insert into public.whatsapp_handoffs (provider_event_id, sender_phone, order_code, reason)
    values (p_provider_event_id, p_sender_phone, p_order_code, p_reason)
    on conflict (provider_event_id) do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end;
$$;

create or replace function public.lookup_whatsapp_orders(p_phone text, p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_phone is null or p_phone !~ '^[0-9]{8,15}$'
    or (p_code is not null and p_code !~* '^NM-[0-9]{3,}$') then
    raise exception 'Invalid WhatsApp order lookup.' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', x.code,
    'orderStatus', x.order_status,
    'paymentStatus', x.payment_status,
    'fulfillmentStatus', x.fulfillment_status,
    'totalCents', x.total_cents,
    'vesTotalCents', x.ves_total_cents,
    'vesPerUsd', x.ves_per_usd::text,
    'exchangeSource', x.exchange_source,
    'paymentInstructions', x.payment_instructions,
    'paymentMethod', x.payment_method,
    'deliveryMethod', x.delivery_method,
    'shippingAgency', x.shipping_agency,
    'shippingCents', x.shipping_cents,
    'createdAt', x.created_at,
    'items', x.items
  ) order by x.created_at desc), '[]'::jsonb)
    into result
    from (
      select o.code, o.order_status, o.payment_status, o.fulfillment_status,
        o.total_cents, o.ves_total_cents, o.ves_per_usd, q.source as exchange_source,
        o.payment_instructions, o.payment_method, o.delivery_method, o.shipping_agency,
        o.shipping_cents, o.created_at,
        coalesce((select jsonb_agg(jsonb_build_object(
          'productName', i.product_name, 'size', i.size, 'color', i.color,
          'quantity', i.quantity, 'unitPriceCents', i.unit_price_cents
        ) order by i.id) from public.order_items i where i.order_id = o.id), '[]'::jsonb) as items
      from public.orders o
      join public.exchange_quotes q on q.id = o.exchange_quote_id
      where regexp_replace(coalesce(o.customer->>'phone', ''), '[^0-9]', '', 'g') = p_phone
        and (p_code is null or upper(o.code) = upper(p_code))
      order by o.created_at desc
      limit 10
    ) x;
  return result;
end;
$$;

create or replace function public.submit_whatsapp_payment_reference(
  p_phone text,
  p_order_code text,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
  attempt_id uuid;
  prior_status text;
begin
  if p_phone is null or p_phone !~ '^[0-9]{8,15}$'
    or p_order_code is null or p_order_code !~* '^NM-[0-9]{3,}$'
    or p_reference is null or p_reference !~* '^[A-Z0-9-]{4,30}$' then
    raise exception 'Invalid payment reference.' using errcode = '22023';
  end if;
  select * into order_row from public.orders
    where upper(code) = upper(p_order_code)
      and regexp_replace(coalesce(customer->>'phone', ''), '[^0-9]', '', 'g') = p_phone
    for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if order_row.payment_method not in ('pago_movil', 'transferencia') then
    return jsonb_build_object('status', 'unsupported_method', 'code', order_row.code);
  end if;
  if order_row.payment_status in ('paid', 'rejected', 'cancelled') or order_row.order_status = 'cancelled' then
    return jsonb_build_object('status', 'already_verified', 'code', order_row.code);
  end if;

  prior_status := order_row.payment_status;
  select id into attempt_id from public.payment_attempts
    where order_id = order_row.id and status in ('pending', 'review')
    order by created_at desc limit 1 for update;
  if attempt_id is null then
    insert into public.payment_attempts (order_id, payment_method, status, reference, note)
      values (order_row.id, order_row.payment_method, 'review', p_reference,
        'Referencia informada por WhatsApp; requiere revisión manual.')
      returning id into attempt_id;
  else
    update public.payment_attempts set status = 'review', reference = p_reference,
      note = 'Referencia informada por WhatsApp; requiere revisión manual.'
      where id = attempt_id;
  end if;
  update public.orders set payment_status = 'review' where id = order_row.id;
  if prior_status <> 'review' then
    insert into public.audit_events (order_id, axis, from_status, to_status, note)
      values (order_row.id, 'payment', prior_status, 'review', 'Referencia informada por WhatsApp; verificación humana pendiente.');
  end if;
  return jsonb_build_object('status', 'submitted', 'code', order_row.code, 'paymentStatus', 'review');
end;
$$;

create or replace function public.enqueue_whatsapp_order_followup(p_order_id uuid, p_sender_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued boolean := false;
begin
  if p_order_id is null or p_sender_hash is null or p_sender_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid WhatsApp follow-up request.' using errcode = '22023';
  end if;
  if exists (select 1 from public.whatsapp_opt_outs where sender_hash = p_sender_hash) then
    return false;
  end if;
  insert into public.whatsapp_order_followups (order_id, sender_hash)
    select o.id, p_sender_hash from public.orders o
    where o.id = p_order_id and o.whatsapp_opt_in and o.whatsapp_opt_in_at is not null
      and regexp_replace(coalesce(o.customer->>'phone', ''), '[^0-9]', '', 'g') <> ''
    on conflict (order_id) do nothing
    returning true into queued;
  return coalesce(queued, false);
end;
$$;

create or replace function public.claim_whatsapp_order_followup(p_order_id uuid, p_sender_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
begin
  if p_order_id is null or p_sender_hash is null or p_sender_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid WhatsApp follow-up claim.' using errcode = '22023';
  end if;
  if exists (select 1 from public.whatsapp_opt_outs where sender_hash = p_sender_hash) then
    update public.whatsapp_order_followups set status = 'failed', attempt_count = 5,
      last_error_code = 'recipient_opted_out', lease_expires_at = null, updated_at = now()
      where order_id = p_order_id and status in ('pending', 'failed');
    return null;
  end if;
  select o.* into order_row from public.orders o
    join public.whatsapp_order_followups f on f.order_id = o.id
    where o.id = p_order_id and o.whatsapp_opt_in and f.attempt_count < 5
      and f.sender_hash = p_sender_hash
      and (f.status = 'pending' or (f.status = 'failed' and f.updated_at < now() - interval '2 minutes')
        or (f.status = 'sending' and f.lease_expires_at < now()))
    for update of f, o;
  if not found then return null; end if;
  update public.whatsapp_order_followups set status = 'sending', attempt_count = attempt_count + 1,
    lease_expires_at = now() + interval '3 minutes', updated_at = now(), last_error_code = null
    where order_id = p_order_id;
  return jsonb_build_object(
    'orderId', order_row.id,
    'code', order_row.code,
    'phone', regexp_replace(coalesce(order_row.customer->>'phone', ''), '[^0-9]', '', 'g')
  );
end;
$$;

create or replace function public.finish_whatsapp_order_followup(
  p_order_id uuid,
  p_status text,
  p_provider_message_id text,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_order_id is null or p_status not in ('sent', 'failed')
    or (p_provider_message_id is not null and length(p_provider_message_id) > 255) then
    raise exception 'Invalid WhatsApp follow-up status.' using errcode = '22023';
  end if;
  update public.whatsapp_order_followups set status = p_status,
    provider_message_id = p_provider_message_id,
    last_error_code = left(regexp_replace(coalesce(p_error_code, ''), '[^a-zA-Z0-9_-]', '', 'g'), 80),
    lease_expires_at = null, updated_at = now()
    where order_id = p_order_id and status = 'sending';
  return found;
end;
$$;

create or replace function public.enqueue_whatsapp_reply(
  p_provider_event_id text,
  p_recipient_phone text,
  p_recipient_hash text,
  p_body text,
  p_window_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted boolean := false;
begin
  if p_provider_event_id is null or length(p_provider_event_id) < 4 or length(p_provider_event_id) > 255
    or p_recipient_phone is null or p_recipient_phone !~ '^[0-9]{8,15}$'
    or p_recipient_hash is null or p_recipient_hash !~ '^[0-9a-f]{64}$'
    or p_body is null or length(p_body) < 1 or length(p_body) > 2000
    or p_window_expires_at is null or p_window_expires_at <= now()
    or p_window_expires_at > now() + interval '24 hours' then
    raise exception 'Invalid WhatsApp reply queue item.' using errcode = '22023';
  end if;
  with expired as (
    select provider_event_id from public.whatsapp_outbound_messages
    where status in ('sent', 'failed') and updated_at < now() - interval '7 days'
    order by updated_at limit 200
  )
  delete from public.whatsapp_outbound_messages m using expired x where m.provider_event_id = x.provider_event_id;
  insert into public.whatsapp_outbound_messages (
    provider_event_id, recipient_phone, recipient_hash, body, window_expires_at
  ) values (p_provider_event_id, p_recipient_phone, p_recipient_hash, p_body, p_window_expires_at)
  on conflict (provider_event_id) do nothing returning true into inserted;
  return coalesce(inserted, false);
end;
$$;

create or replace function public.claim_whatsapp_reply(p_provider_event_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  message_row public.whatsapp_outbound_messages;
begin
  if exists (
    select 1 from public.whatsapp_outbound_messages m
    join public.whatsapp_opt_outs o on o.sender_hash = m.recipient_hash
    where m.provider_event_id = p_provider_event_id
  ) then
    update public.whatsapp_outbound_messages set status = 'failed',
      attempt_count = 5, last_error_code = 'recipient_opted_out', lease_expires_at = null, updated_at = now()
      where provider_event_id = p_provider_event_id and status in ('pending', 'failed', 'sending');
    return null;
  end if;
  select * into message_row from public.whatsapp_outbound_messages
    where provider_event_id = p_provider_event_id and window_expires_at > now()
      and attempt_count < 5
      and (status = 'pending' or (status = 'failed' and updated_at < now() - interval '2 minutes')
        or (status = 'sending' and lease_expires_at < now()))
    for update;
  if not found then return null; end if;
  update public.whatsapp_outbound_messages set status = 'sending', attempt_count = attempt_count + 1,
    lease_expires_at = now() + interval '3 minutes', updated_at = now(), last_error_code = null
    where provider_event_id = message_row.provider_event_id;
  return jsonb_build_object(
    'providerEventId', message_row.provider_event_id,
    'recipientPhone', message_row.recipient_phone,
    'body', message_row.body,
    'windowExpiresAt', message_row.window_expires_at
  );
end;
$$;

create or replace function public.record_whatsapp_delivery_status(
  p_provider_message_id text,
  p_status text,
  p_event_at timestamptz,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_provider_message_id is null or length(p_provider_message_id) < 4
    or length(p_provider_message_id) > 255
    or p_status is null or p_status not in ('sent', 'delivered', 'read', 'failed')
    or p_event_at is null or p_event_at > now() + interval '5 minutes'
    or p_event_at < now() - interval '90 days' then
    raise exception 'Invalid WhatsApp delivery status.' using errcode = '22023';
  end if;
  insert into public.whatsapp_delivery_receipts (
    provider_message_id, status, event_at, error_code
  ) values (
    p_provider_message_id, p_status, p_event_at,
    left(regexp_replace(coalesce(p_error_code, ''), '[^a-zA-Z0-9_-]', '', 'g'), 80)
  ) on conflict (provider_message_id) do update set
    status = excluded.status,
    event_at = excluded.event_at,
    error_code = excluded.error_code,
    updated_at = now()
  where excluded.event_at > public.whatsapp_delivery_receipts.event_at
    or (excluded.event_at = public.whatsapp_delivery_receipts.event_at and
      case excluded.status when 'failed' then 0 when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 end
      >= case public.whatsapp_delivery_receipts.status when 'failed' then 0 when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 end);
  return true;
end;
$$;

create or replace function public.finish_whatsapp_reply(
  p_provider_event_id text,
  p_status text,
  p_provider_message_id text,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_provider_event_id is null or p_status not in ('sent', 'failed')
    or (p_provider_message_id is not null and length(p_provider_message_id) > 255) then
    raise exception 'Invalid WhatsApp reply status.' using errcode = '22023';
  end if;
  update public.whatsapp_outbound_messages set status = p_status,
    provider_message_id = p_provider_message_id,
    last_error_code = left(regexp_replace(coalesce(p_error_code, ''), '[^a-zA-Z0-9_-]', '', 'g'), 80),
    lease_expires_at = null, updated_at = now()
    where provider_event_id = p_provider_event_id and status = 'sending';
  return found;
end;
$$;

create or replace function public.create_public_order_whatsapp_v3(
  p_idempotency_key uuid,
  p_tracking_token_hash text,
  p_customer jsonb,
  p_delivery_method text,
  p_shipping_address jsonb,
  p_shipping_agency text,
  p_payment_method text,
  p_customer_note text,
  p_items jsonb,
  p_quote_id uuid,
  p_expected_subtotal_cents integer,
  p_expected_shipping_cents integer,
  p_expected_total_cents integer,
  p_expected_ves_total_cents bigint,
  p_whatsapp_opt_in boolean,
  p_sender_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  order_id uuid;
  order_phone text;
  had_whatsapp_consent boolean := false;
  had_whatsapp_opt_out boolean := false;
begin
  if p_whatsapp_opt_in is null
    or (p_whatsapp_opt_in and (p_sender_hash is null or p_sender_hash !~ '^[0-9a-f]{64}$'))
    or (p_sender_hash is not null and p_sender_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Invalid WhatsApp consent.' using errcode = '22023';
  end if;
  result := public.create_public_order_v2(
    p_idempotency_key, p_tracking_token_hash, p_customer, p_delivery_method,
    p_shipping_address, p_shipping_agency, p_payment_method, p_customer_note,
    p_items, p_quote_id, p_expected_subtotal_cents, p_expected_shipping_cents,
    p_expected_total_cents, p_expected_ves_total_cents
  );
  order_id := (result->>'id')::uuid;
  select whatsapp_opt_in into had_whatsapp_consent from public.orders where id = order_id;
  update public.orders set
    whatsapp_opt_in = whatsapp_opt_in or p_whatsapp_opt_in,
    whatsapp_opt_in_at = case
      when p_whatsapp_opt_in and not whatsapp_opt_in then now()
      else whatsapp_opt_in_at
    end
    where id = order_id
    returning regexp_replace(coalesce(customer->>'phone', ''), '[^0-9]', '', 'g') into order_phone;
  if p_whatsapp_opt_in and order_phone <> '' then
    select exists (
      select 1 from public.whatsapp_opt_outs where sender_hash = p_sender_hash
    ) into had_whatsapp_opt_out;
    delete from public.whatsapp_opt_outs where sender_hash = p_sender_hash;
    if not had_whatsapp_consent or had_whatsapp_opt_out then
      insert into public.whatsapp_consent_events (sender_hash, order_id, event_type, consent_version)
        values (p_sender_hash, order_id, 'granted', 'order-updates-v1');
    end if;
    insert into public.whatsapp_order_followups (order_id, sender_hash)
      values (order_id, p_sender_hash)
      on conflict (order_id) do update set
        sender_hash = excluded.sender_hash,
        status = 'pending',
        attempt_count = 0,
        lease_expires_at = null,
        last_error_code = null,
        updated_at = now()
      where had_whatsapp_opt_out
        and public.whatsapp_order_followups.status = 'failed'
        and public.whatsapp_order_followups.last_error_code = 'recipient_opted_out';
  end if;
  return result;
end;
$$;

revoke execute on function public.claim_whatsapp_webhook_event(text, text) from public, anon, authenticated;
revoke execute on function public.complete_whatsapp_webhook_event(text) from public, anon, authenticated;
revoke execute on function public.fail_whatsapp_webhook_event(text, text) from public, anon, authenticated;
revoke execute on function public.get_whatsapp_conversation(text) from public, anon, authenticated;
revoke execute on function public.save_whatsapp_conversation(text, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.record_whatsapp_opt_out(text, text) from public, anon, authenticated;
revoke execute on function public.is_whatsapp_opted_out(text) from public, anon, authenticated;
revoke execute on function public.is_whatsapp_handoff_active(text) from public, anon, authenticated;
revoke execute on function public.lookup_whatsapp_orders(text, text) from public, anon, authenticated;
revoke execute on function public.submit_whatsapp_payment_reference(text, text, text) from public, anon, authenticated;
revoke execute on function public.enqueue_whatsapp_order_followup(uuid, text) from public, anon, authenticated;
revoke execute on function public.claim_whatsapp_order_followup(uuid, text) from public, anon, authenticated;
revoke execute on function public.finish_whatsapp_order_followup(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.enqueue_whatsapp_reply(text, text, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.claim_whatsapp_reply(text) from public, anon, authenticated;
revoke execute on function public.record_whatsapp_delivery_status(text, text, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.finish_whatsapp_reply(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.create_public_order_whatsapp_v3(uuid, text, jsonb, text, jsonb, text, text, text, jsonb, uuid, integer, integer, integer, bigint, boolean, text) from public, anon, authenticated;

grant execute on function public.claim_whatsapp_webhook_event(text, text) to service_role;
grant execute on function public.complete_whatsapp_webhook_event(text) to service_role;
grant execute on function public.fail_whatsapp_webhook_event(text, text) to service_role;
grant execute on function public.get_whatsapp_conversation(text) to service_role;
grant execute on function public.save_whatsapp_conversation(text, jsonb, timestamptz) to service_role;
grant execute on function public.record_whatsapp_opt_out(text, text) to service_role;
grant execute on function public.is_whatsapp_opted_out(text) to service_role;
grant execute on function public.is_whatsapp_handoff_active(text) to service_role;
grant execute on function public.lookup_whatsapp_orders(text, text) to service_role;
grant execute on function public.submit_whatsapp_payment_reference(text, text, text) to service_role;
grant execute on function public.enqueue_whatsapp_order_followup(uuid, text) to service_role;
grant execute on function public.claim_whatsapp_order_followup(uuid, text) to service_role;
grant execute on function public.finish_whatsapp_order_followup(uuid, text, text, text) to service_role;
grant execute on function public.enqueue_whatsapp_reply(text, text, text, text, timestamptz) to service_role;
grant execute on function public.claim_whatsapp_reply(text) to service_role;
grant execute on function public.record_whatsapp_delivery_status(text, text, timestamptz, text) to service_role;
grant execute on function public.finish_whatsapp_reply(text, text, text, text) to service_role;
grant execute on function public.create_public_order_whatsapp_v3(uuid, text, jsonb, text, jsonb, text, text, text, jsonb, uuid, integer, integer, integer, bigint, boolean, text) to service_role;
