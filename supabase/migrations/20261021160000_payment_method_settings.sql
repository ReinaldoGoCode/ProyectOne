alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('pago_movil', 'transferencia', 'efectivo', 'efectivo_ves', 'efectivo_usd'));
alter table public.orders add column if not exists payment_instructions text not null default '';

create table public.payment_methods (
  method text primary key check (method in (
    'pago_movil', 'transferencia', 'efectivo_ves', 'efectivo_usd',
    'paypal', 'binance_pay', 'card'
  )),
  label text not null,
  kind text not null check (kind in ('manual', 'provider')),
  active boolean not null default false,
  public_instructions text not null default '',
  provider_ready boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (not active or (kind = 'manual' and length(btrim(public_instructions)) >= 8))
);

insert into public.payment_methods (method, label, kind, active, public_instructions) values
  ('pago_movil', 'Pago Móvil', 'manual', false, ''),
  ('transferencia', 'Transferencia bancaria', 'manual', false, ''),
  ('efectivo_ves', 'Efectivo en bolívares', 'manual', false, ''),
  ('efectivo_usd', 'Efectivo en dólares', 'manual', false, ''),
  ('paypal', 'PayPal', 'provider', false, ''),
  ('binance_pay', 'Binance Pay', 'provider', false, ''),
  ('card', 'Tarjeta de crédito o débito', 'provider', false, '')
on conflict (method) do nothing;

alter table public.payment_methods enable row level security;
revoke all on public.payment_methods from public, anon, authenticated;
grant all on public.payment_methods to service_role;

create or replace function public.admin_update_payment_methods(
  p_actor_user_id uuid,
  p_methods jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  method_item jsonb;
  method_name text;
  method_active boolean;
  method_instructions text;
begin
  if not exists (
    select 1 from public.admin_users a
    where a.user_id = p_actor_user_id and a.active
  ) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_methods) is distinct from 'array' then
    raise exception 'Invalid payment method settings.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_methods) <> 4 then
    raise exception 'Invalid payment method settings.' using errcode = '22023';
  end if;
  if (select count(distinct value->>'method') from jsonb_array_elements(p_methods)) <> 4 then
    raise exception 'Duplicate payment method settings.' using errcode = '22023';
  end if;

  for method_item in select value from jsonb_array_elements(p_methods)
  loop
    method_name := method_item->>'method';
    method_instructions := btrim(coalesce(method_item->>'instructions', ''));
    if method_name not in ('pago_movil', 'transferencia', 'efectivo_ves', 'efectivo_usd')
      or jsonb_typeof(method_item->'active') is distinct from 'boolean'
      or length(method_instructions) > 500
      or ((method_item->>'active')::boolean and length(method_instructions) < 8) then
      raise exception 'Invalid manual payment settings.' using errcode = '22023';
    end if;
    method_active := (method_item->>'active')::boolean;
    update public.payment_methods set
      active = method_active,
      public_instructions = method_instructions,
      updated_by = p_actor_user_id,
      updated_at = now()
    where method = method_name and kind = 'manual';
  end loop;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'method', p.method,
      'label', p.label,
      'kind', p.kind,
      'active', p.active,
      'instructions', p.public_instructions,
      'providerReady', p.provider_ready
    ) order by p.method)
    from public.payment_methods p
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_update_payment_methods(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_payment_methods(uuid, jsonb) to service_role;
