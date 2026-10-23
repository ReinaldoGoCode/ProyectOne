create or replace function public.preview_public_order(
  p_items jsonb,
  p_delivery_method text,
  p_quote_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  quote public.exchange_quotes;
  line record;
  variant_row record;
  item_snapshot jsonb := '[]'::jsonb;
  subtotal integer := 0;
  shipping integer;
  total integer;
  ves_total bigint;
  line_count integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 25
    or p_delivery_method not in ('delivery_local', 'envio_nacional', 'retiro') then
    raise exception 'Invalid order quote request.' using errcode = '22023';
  end if;

  select * into quote from public.exchange_quotes
    where id = p_quote_id and expires_at > now()
    for share;
  if not found then raise exception 'Exchange quote expired.' using errcode = '22023'; end if;

  select amount_cents into shipping from public.shipping_rates
    where delivery_method = p_delivery_method;
  if shipping is null then raise exception 'Delivery method unavailable.' using errcode = '22023'; end if;

  for line in
    select x.variant_id, sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(variant_id text, quantity integer)
    group by x.variant_id
  loop
    line_count := line_count + 1;
    if line.quantity < 1 or line.quantity > 10 then
      raise exception 'Invalid item quantity.' using errcode = '22023';
    end if;
    select v.id as variant_id, v.product_id, v.size, v.color, v.sku, v.stock,
      p.name as product_name, p.price_cents
      into variant_row
      from public.variants v join public.products p on p.id = v.product_id
      where v.id = line.variant_id and p.active
      for share of v, p;
    if not found or variant_row.stock < line.quantity then
      raise exception 'A selected variant is unavailable.' using errcode = 'P0002';
    end if;
    subtotal := subtotal + variant_row.price_cents * line.quantity;
    if subtotal > 2147483647 then
      raise exception 'Order total is too large.' using errcode = '22003';
    end if;
    item_snapshot := item_snapshot || jsonb_build_array(jsonb_build_object(
      'variantId', variant_row.variant_id,
      'productName', variant_row.product_name,
      'size', variant_row.size,
      'color', variant_row.color,
      'sku', variant_row.sku,
      'quantity', line.quantity,
      'unitPriceCents', variant_row.price_cents,
      'lineTotalCents', variant_row.price_cents * line.quantity,
      'stockAvailable', variant_row.stock
    ));
  end loop;
  if line_count = 0 then raise exception 'Invalid order lines.' using errcode = '22023'; end if;

  total := subtotal + shipping;
  ves_total := round(total * quote.ves_per_usd)::bigint;
  return jsonb_build_object(
    'quoteId', quote.id,
    'source', quote.source,
    'vesPerUsd', quote.ves_per_usd::text,
    'quotedAt', quote.quoted_at,
    'expiresAt', quote.expires_at,
    'items', item_snapshot,
    'subtotalCents', subtotal,
    'shippingCents', shipping,
    'totalCents', total,
    'vesTotalCents', ves_total
  );
end;
$$;

create or replace function public.create_public_order_v2(
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
  p_expected_ves_total_cents bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  preview jsonb;
  prior_order public.orders;
begin
  select * into prior_order from public.orders where idempotency_key = p_idempotency_key;
  if found then
    if prior_order.tracking_token_hash <> p_tracking_token_hash then
      raise exception 'Idempotency key conflict.' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'id', prior_order.id,
      'code', prior_order.code,
      'createdAt', prior_order.created_at,
      'subtotalCents', prior_order.subtotal_cents,
      'shippingCents', prior_order.shipping_cents,
      'totalCents', prior_order.total_cents,
      'vesPerUsd', prior_order.ves_per_usd::text,
      'vesTotalCents', prior_order.ves_total_cents,
      'orderStatus', prior_order.order_status,
      'paymentStatus', prior_order.payment_status,
      'fulfillmentStatus', prior_order.fulfillment_status
    );
  end if;

  preview := public.preview_public_order(p_items, p_delivery_method, p_quote_id);
  if (preview->>'subtotalCents')::integer <> p_expected_subtotal_cents
    or (preview->>'shippingCents')::integer <> p_expected_shipping_cents
    or (preview->>'totalCents')::integer <> p_expected_total_cents
    or (preview->>'vesTotalCents')::bigint <> p_expected_ves_total_cents then
    raise exception 'Quoted amount changed; buyer confirmation is required.' using errcode = 'P0001';
  end if;

  return public.create_public_order(
    p_idempotency_key,
    p_tracking_token_hash,
    p_customer,
    p_delivery_method,
    p_shipping_address,
    p_shipping_agency,
    p_payment_method,
    p_customer_note,
    p_items,
    p_quote_id
  );
end;
$$;

revoke execute on function public.preview_public_order(jsonb, text, uuid) from public, anon, authenticated;
revoke execute on function public.create_public_order_v2(uuid, text, jsonb, text, jsonb, text, text, text, jsonb, uuid, integer, integer, integer, bigint) from public, anon, authenticated;
grant execute on function public.preview_public_order(jsonb, text, uuid) to service_role;
grant execute on function public.create_public_order_v2(uuid, text, jsonb, text, jsonb, text, text, text, jsonb, uuid, integer, integer, integer, bigint) to service_role;
