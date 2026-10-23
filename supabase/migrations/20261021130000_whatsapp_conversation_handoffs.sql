create table public.whatsapp_handoffs (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  sender_phone text not null check (sender_phone ~ '^[0-9]{8,15}$'),
  order_code text,
  reason text not null check (reason in ('human_requested', 'payment_instructions_missing', 'unknown_request')),
  status text not null default 'open' check (status in ('open', 'claimed', 'resolved')),
  claimed_by uuid,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_handoffs_status_created_idx
  on public.whatsapp_handoffs (status, created_at desc);

alter table public.whatsapp_handoffs enable row level security;
revoke all on public.whatsapp_handoffs from public, anon, authenticated;
grant all on public.whatsapp_handoffs to service_role;

create or replace function public.lookup_order_for_whatsapp(p_phone text, p_code text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', o.code,
    'orderStatus', o.order_status,
    'paymentStatus', o.payment_status,
    'fulfillmentStatus', o.fulfillment_status,
    'paymentInstructions', o.payment_instructions,
    'totalCents', o.total_cents,
    'vesTotalCents', o.ves_total_cents,
    'vesPerUsd', o.ves_per_usd::text,
    'exchangeSource', q.source
  )
  from public.orders o
  join public.exchange_quotes q on q.id = o.exchange_quote_id
  where upper(o.code) = upper(trim(p_code))
    and regexp_replace(coalesce(o.customer->>'phone', ''), '[^0-9]', '', 'g') = p_phone
  limit 1;
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
  if length(p_provider_event_id) < 4 or length(p_provider_event_id) > 255
    or p_sender_phone !~ '^[0-9]{8,15}$'
    or p_reason not in ('human_requested', 'payment_instructions_missing', 'unknown_request')
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

create or replace function public.admin_update_whatsapp_handoff(
  p_handoff_id uuid,
  p_next_status text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  handoff public.whatsapp_handoffs;
begin
  if not exists (select 1 from public.admin_users where user_id = p_actor_user_id and active) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  select * into handoff from public.whatsapp_handoffs where id = p_handoff_id for update;
  if not found then raise exception 'Handoff not found.' using errcode = 'P0002'; end if;
  if p_next_status not in ('claimed', 'resolved')
    or handoff.status = 'resolved'
    or (p_next_status = 'claimed' and handoff.status <> 'open') then
    raise exception 'Invalid handoff transition.' using errcode = '22023';
  end if;
  update public.whatsapp_handoffs set
    status = p_next_status,
    claimed_by = case when p_next_status = 'claimed' then p_actor_user_id else claimed_by end,
    resolved_by = case when p_next_status = 'resolved' then p_actor_user_id else resolved_by end,
    updated_at = now()
    where id = handoff.id;
  return jsonb_build_object('id', handoff.id, 'status', p_next_status);
end;
$$;

revoke execute on function public.lookup_order_for_whatsapp(text, text) from public, anon, authenticated;
revoke execute on function public.create_whatsapp_handoff(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.admin_update_whatsapp_handoff(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.lookup_order_for_whatsapp(text, text) to service_role;
grant execute on function public.create_whatsapp_handoff(text, text, text, text) to service_role;
grant execute on function public.admin_update_whatsapp_handoff(uuid, text, uuid) to service_role;
