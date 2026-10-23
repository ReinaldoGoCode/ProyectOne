-- Permite que el comprador registre, con su enlace privado, la referencia de
-- una operación de pago. Nunca aprueba el pago: solo lo deja en revisión manual.
-- El comprobante en imagen queda fuera de esta función; el panel muestra la
-- referencia y un administrador autorizado decide el estado.

create or replace function public.submit_public_payment_reference(
  p_code text,
  p_tracking_token_hash text,
  p_reference text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
  existing_attempt public.payment_attempts;
  normalized_reference text := upper(regexp_replace(trim(coalesce(p_reference, '')), '\s+', ' ', 'g'));
  normalized_note text := left(trim(coalesce(p_note, '')), 300);
  previous_status text;
  submitted_at timestamptz := now();
begin
  if p_code is null
    or p_code !~ '^NM-[0-9]{3,12}$'
    or p_tracking_token_hash !~ '^[0-9a-f]{64}$'
    or normalized_reference !~ '^[A-Z0-9][A-Z0-9._ -]{3,79}$' then
    raise exception 'Invalid payment reference request.' using errcode = '22023';
  end if;

  select * into order_row
    from public.orders
    where upper(code) = upper(trim(p_code))
      and tracking_token_hash = p_tracking_token_hash
    for update;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;

  if order_row.order_status = 'cancelled' or order_row.payment_status = 'cancelled' then
    raise exception 'Cancelled orders do not accept payment references.' using errcode = '22023';
  end if;

  if order_row.payment_status = 'paid' then
    return jsonb_build_object(
      'paymentStatus', order_row.payment_status,
      'reference', null,
      'submittedAt', null,
      'alreadyVerified', true
    );
  end if;

  select * into existing_attempt
    from public.payment_attempts
    where order_id = order_row.id and reference = normalized_reference
    order by created_at desc
    limit 1;
  if found then
    return jsonb_build_object(
      'paymentStatus', order_row.payment_status,
      'reference', existing_attempt.reference,
      'submittedAt', existing_attempt.created_at,
      'alreadySubmitted', true
    );
  end if;

  previous_status := order_row.payment_status;

  insert into public.payment_attempts (order_id, payment_method, status, reference, note)
    values (
      order_row.id,
      order_row.payment_method,
      'review',
      normalized_reference,
      nullif(normalized_note, '')
    );

  update public.orders
    set payment_status = 'review'
    where id = order_row.id and payment_status in ('pending', 'rejected');

  insert into public.audit_events (order_id, axis, from_status, to_status, note)
    values (
      order_row.id,
      'payment',
      previous_status,
      'review',
      'Referencia informada por el comprador. Pendiente de verificación manual.'
    );

  return jsonb_build_object(
    'paymentStatus', 'review',
    'reference', normalized_reference,
    'submittedAt', submitted_at,
    'alreadySubmitted', false
  );
end;
$$;

revoke execute on function public.submit_public_payment_reference(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_public_payment_reference(text, text, text, text)
  to service_role;

-- El enlace privado puede mostrar la referencia registrada, pero no datos
-- bancarios ni el historial interno de revisión.
create or replace function public.lookup_public_order(p_code text, p_tracking_token_hash text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'createdAt', o.created_at, 'customer', o.customer,
    'deliveryMethod', o.delivery_method, 'shippingAddress', o.shipping_address, 'shippingAgency', o.shipping_agency,
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
