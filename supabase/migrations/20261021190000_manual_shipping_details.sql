-- Datos manuales de despacho. No hay integración con MRW ni Zoom: la tienda
-- registra la empresa, la guía y observaciones, y el comprador las consulta con
-- su enlace privado. El estado logístico sigue siendo una transición separada.

alter table public.orders
  add column if not exists shipping_company text,
  add column if not exists shipping_tracking_number text,
  add column if not exists shipping_notes text;

alter table public.orders drop constraint if exists orders_shipping_company_check;
alter table public.orders add constraint orders_shipping_company_check
  check (shipping_company is null or char_length(shipping_company) between 2 and 80);

alter table public.orders drop constraint if exists orders_shipping_tracking_check;
alter table public.orders add constraint orders_shipping_tracking_check
  check (shipping_tracking_number is null or char_length(shipping_tracking_number) between 2 and 80);

alter table public.orders drop constraint if exists orders_shipping_notes_check;
alter table public.orders add constraint orders_shipping_notes_check
  check (shipping_notes is null or char_length(shipping_notes) <= 500);

create or replace function public.admin_set_shipping_details(
  p_order_id uuid,
  p_shipping_company text,
  p_shipping_tracking_number text,
  p_shipping_notes text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
  normalized_company text := nullif(trim(coalesce(p_shipping_company, '')), '');
  normalized_tracking text := nullif(trim(coalesce(p_shipping_tracking_number, '')), '');
  normalized_notes text := nullif(trim(coalesce(p_shipping_notes, '')), '');
begin
  if not exists (select 1 from public.admin_users a where a.user_id = p_actor_user_id and a.active) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  select * into order_row from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.' using errcode = 'P0002'; end if;
  if order_row.order_status = 'cancelled' or order_row.fulfillment_status = 'cancelled' then
    raise exception 'Cancelled orders do not accept shipping details.' using errcode = '22023';
  end if;

  if normalized_company is not null and char_length(normalized_company) < 2 then
    raise exception 'Shipping company is too short.' using errcode = '22023';
  end if;
  if normalized_tracking is not null and char_length(normalized_tracking) < 2 then
    raise exception 'Tracking number is too short.' using errcode = '22023';
  end if;
  if normalized_company is not null and char_length(normalized_company) > 80 then
    raise exception 'Shipping company is too long.' using errcode = '22023';
  end if;
  if normalized_tracking is not null and char_length(normalized_tracking) > 80 then
    raise exception 'Tracking number is too long.' using errcode = '22023';
  end if;
  if normalized_notes is not null and char_length(normalized_notes) > 500 then
    raise exception 'Shipping notes are too long.' using errcode = '22023';
  end if;

  update public.orders
    set shipping_company = normalized_company,
        shipping_tracking_number = normalized_tracking,
        shipping_notes = normalized_notes
    where id = order_row.id;

  insert into public.audit_events (order_id, axis, from_status, to_status, actor_user_id, note)
    values (
      order_row.id,
      'fulfillment',
      order_row.fulfillment_status,
      order_row.fulfillment_status,
      p_actor_user_id,
      left(
        'Datos de envío manual: ' || coalesce(normalized_company, 'sin empresa') ||
        ' · guía ' || coalesce(normalized_tracking, 'sin guía') ||
        case when normalized_notes is null then '' else ' · ' || normalized_notes end,
        500
      )
    );

  return jsonb_build_object(
    'id', order_row.id,
    'shippingCompany', normalized_company,
    'shippingTrackingNumber', normalized_tracking,
    'shippingNotes', normalized_notes
  );
end;
$$;

revoke execute on function public.admin_set_shipping_details(uuid, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_set_shipping_details(uuid, text, text, text, uuid)
  to service_role;

-- El comprador puede ver los datos de despacho solo con su token privado.
create or replace function public.lookup_public_order(p_code text, p_tracking_token_hash text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'createdAt', o.created_at, 'customer', o.customer,
    'deliveryMethod', o.delivery_method, 'shippingAddress', o.shipping_address, 'shippingAgency', o.shipping_agency,
    'shippingCompany', o.shipping_company, 'shippingTrackingNumber', o.shipping_tracking_number,
    'shippingNotes', o.shipping_notes,
    'paymentMethod', o.payment_method, 'paymentInstructions', o.payment_instructions,
    'paymentReference', (
      select pa.reference from public.payment_attempts pa
      where pa.order_id = o.id and pa.reference is not null
      order by pa.created_at desc limit 1
    ),
    'customerNote', o.customer_note,
    'subtotalCents', o.subtotal_cents, 'shippingCents', o.shipping_cents, 'totalCents', o.total_cents,
    'vesPerUsd', o.ves_per_usd::text, 'vesTotalCents', o.ves_total_cents,
    'orderStatus', o.order_status, 'paymentStatus', o.payment_status, 'fulfillmentStatus', o.fulfillment_status,
    'items', coalesce((select jsonb_agg(jsonb_build_object('productId', i.product_id, 'productName', i.product_name, 'variantId', i.variant_id,
      'size', i.size, 'color', i.color, 'unitPriceCents', i.unit_price_cents, 'quantity', i.quantity) order by i.id)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'notes', '[]'::jsonb,
    'exchangeQuote', jsonb_build_object('vesPerUsd', o.ves_per_usd::text, 'source', q.source,
      'quotedAt', q.quoted_at, 'expiresAt', q.expires_at),
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'axis', e.axis, 'from', e.from_status,
      'to', e.to_status, 'at', e.created_at, 'note', e.note) order by e.created_at, e.id)
      from public.audit_events e where e.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o join public.exchange_quotes q on q.id = o.exchange_quote_id
  where upper(o.code) = upper(trim(p_code)) and o.tracking_token_hash = p_tracking_token_hash;
$$;

revoke execute on function public.lookup_public_order(text, text) from public, anon, authenticated;
grant execute on function public.lookup_public_order(text, text) to service_role;

-- El asistente de WhatsApp puede informar el despacho al comprador que ya
-- verificó su teléfono, sin exponer pedidos de otros números.
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
    'shippingCompany', x.shipping_company,
    'shippingTrackingNumber', x.shipping_tracking_number,
    'shippingNotes', x.shipping_notes,
    'shippingCents', x.shipping_cents,
    'createdAt', x.created_at,
    'items', x.items
  ) order by x.created_at desc), '[]'::jsonb)
    into result
    from (
      select o.code, o.order_status, o.payment_status, o.fulfillment_status,
        o.total_cents, o.ves_total_cents, o.ves_per_usd, q.source as exchange_source,
        o.payment_instructions, o.payment_method, o.delivery_method, o.shipping_agency,
        o.shipping_company, o.shipping_tracking_number, o.shipping_notes,
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

revoke execute on function public.lookup_whatsapp_orders(text, text) from public, anon, authenticated;
grant execute on function public.lookup_whatsapp_orders(text, text) to service_role;
