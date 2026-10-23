create sequence if not exists public.order_code_seq start 1;

create table public.categories (
  id text primary key,
  slug text not null unique,
  name text not null,
  description text not null default ''
);

create table public.products (
  id text primary key,
  slug text not null unique,
  name text not null,
  category_id text not null references public.categories(id),
  description text not null default '',
  composition text not null default '',
  care text not null default '',
  price_cents integer not null check (price_cents > 0),
  image_url text not null,
  image_alt text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.variants (
  id text primary key,
  product_id text not null references public.products(id),
  size text not null check (size in ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único')),
  color text not null,
  sku text not null unique,
  stock integer not null default 0 check (stock >= 0),
  unique (product_id, size, color)
);

create table public.shipping_rates (
  delivery_method text primary key check (delivery_method in ('delivery_local', 'envio_nacional', 'retiro')),
  amount_cents integer not null check (amount_cents >= 0),
  demo_only boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.shipping_rates (delivery_method, amount_cents, demo_only)
values ('delivery_local', 300, true), ('envio_nacional', 500, true), ('retiro', 0, true)
on conflict (delivery_method) do nothing;

create table public.exchange_quotes (
  id uuid primary key default gen_random_uuid(),
  ves_per_usd numeric(16, 6) not null check (ves_per_usd > 0),
  source text not null check (source in ('demo_ficticia', 'bcv')),
  quoted_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > quoted_at),
  created_at timestamptz not null default now()
);

create index exchange_quotes_latest_idx on public.exchange_quotes (quoted_at desc);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('NM-' || lpad(nextval('public.order_code_seq')::text, 4, '0')),
  idempotency_key uuid not null unique,
  tracking_token_hash text not null unique check (tracking_token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  customer jsonb not null,
  delivery_method text not null check (delivery_method in ('delivery_local', 'envio_nacional', 'retiro')),
  shipping_address jsonb,
  shipping_agency text,
  payment_method text not null check (payment_method in ('pago_movil', 'transferencia', 'efectivo')),
  -- Captured public instructions. The full payment_methods catalog arrives in a
  -- later migration; the initial column keeps lookup_public_order valid from
  -- the first migration onward.
  payment_instructions text not null default '',
  customer_note text,
  currency text not null default 'USD' check (currency = 'USD'),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null check (shipping_cents >= 0),
  total_cents integer not null check (total_cents = subtotal_cents + shipping_cents),
  exchange_quote_id uuid not null references public.exchange_quotes(id),
  ves_per_usd numeric(16, 6) not null check (ves_per_usd > 0),
  ves_total_cents bigint not null check (ves_total_cents >= 0),
  order_status text not null default 'awaiting_payment'
    check (order_status in ('awaiting_payment', 'confirmed', 'inventory_exception', 'cancelled')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'review', 'paid', 'rejected', 'cancelled')),
  fulfillment_status text not null default 'new'
    check (fulfillment_status in ('new', 'preparing', 'shipped', 'delivered', 'cancelled'))
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null,
  variant_id text not null,
  product_name text not null,
  size text not null,
  color text not null,
  unit_price_cents integer not null check (unit_price_cents > 0),
  quantity integer not null check (quantity between 1 and 10)
);

create index order_items_order_id_idx on public.order_items (order_id);

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_method text not null,
  status text not null check (status in ('pending', 'review', 'paid', 'rejected', 'cancelled')),
  reference text,
  note text,
  reviewed_by uuid,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  axis text not null check (axis in ('order', 'payment', 'fulfillment')),
  from_status text,
  to_status text not null,
  actor_user_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index audit_events_order_created_idx on public.audit_events (order_id, created_at);

create table public.inventory_exceptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id text not null,
  requested_quantity integer not null check (requested_quantity > 0),
  available_quantity integer not null check (available_quantity >= 0),
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index admin_users_single_active_idx on public.admin_users ((true)) where active;

create table public.whatsapp_webhook_events (
  provider_event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.variants enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.exchange_quotes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.audit_events enable row level security;
alter table public.inventory_exceptions enable row level security;
alter table public.admin_users enable row level security;
alter table public.whatsapp_webhook_events enable row level security;

create policy "public reads active categories" on public.categories for select to anon, authenticated using (
  exists (select 1 from public.products p where p.category_id = categories.id and p.active)
);
create policy "public reads active products" on public.products for select to anon, authenticated using (active);
create policy "public reads active variants" on public.variants for select to anon, authenticated using (
  exists (select 1 from public.products p where p.id = variants.product_id and p.active)
);
create policy "admin reads own membership" on public.admin_users for select to authenticated using (
  user_id = (select auth.uid()) and active
);

revoke all on all tables in schema public from anon, authenticated;
grant select on public.categories, public.products, public.variants to anon, authenticated;
grant select on public.admin_users to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

create or replace function public.issue_demo_quote()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  quote public.exchange_quotes;
begin
  perform pg_advisory_xact_lock(hashtext('norte-moda-demo-fx-quote'));
  select * into quote from public.exchange_quotes
    where source = 'demo_ficticia' and expires_at > now()
    order by quoted_at desc limit 1;
  if found then
    return jsonb_build_object(
      'id', quote.id,
      'vesPerUsd', quote.ves_per_usd::text,
      'source', quote.source,
      'quotedAt', quote.quoted_at,
      'expiresAt', quote.expires_at
    );
  end if;
  insert into public.exchange_quotes (ves_per_usd, source, quoted_at, expires_at)
  values (40.000000, 'demo_ficticia', now(), now() + interval '15 minutes')
  returning * into quote;

  return jsonb_build_object(
    'id', quote.id,
    'vesPerUsd', quote.ves_per_usd::text,
    'source', quote.source,
    'quotedAt', quote.quoted_at,
    'expiresAt', quote.expires_at
  );
end;
$$;

create or replace function public.create_public_order(
  p_idempotency_key uuid,
  p_tracking_token_hash text,
  p_customer jsonb,
  p_delivery_method text,
  p_shipping_address jsonb,
  p_shipping_agency text,
  p_payment_method text,
  p_customer_note text,
  p_items jsonb,
  p_quote_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior_order public.orders;
  quote public.exchange_quotes;
  order_row public.orders;
  line record;
  variant_row record;
  subtotal integer := 0;
  shipping integer;
  total integer;
  ves_total bigint;
  payment_text text;
  line_count integer := 0;
begin
  if p_idempotency_key is null or p_tracking_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid order request.' using errcode = '22023';
  end if;

  select * into prior_order from public.orders where idempotency_key = p_idempotency_key;
  if found then
    if prior_order.tracking_token_hash <> p_tracking_token_hash then
      raise exception 'Idempotency key conflict.' using errcode = '22023';
    end if;
    return jsonb_build_object('id', prior_order.id, 'code', prior_order.code, 'createdAt', prior_order.created_at,
      'subtotalCents', prior_order.subtotal_cents, 'shippingCents', prior_order.shipping_cents,
      'totalCents', prior_order.total_cents, 'vesPerUsd', prior_order.ves_per_usd::text,
      'vesTotalCents', prior_order.ves_total_cents, 'orderStatus', prior_order.order_status,
      'paymentStatus', prior_order.payment_status, 'fulfillmentStatus', prior_order.fulfillment_status);
  end if;

  if jsonb_typeof(p_customer) <> 'object'
    or length(trim(coalesce(p_customer->>'firstName', ''))) < 2
    or length(trim(coalesce(p_customer->>'lastName', ''))) < 2
    or length(trim(coalesce(p_customer->>'phone', ''))) < 8 then
    raise exception 'Invalid customer details.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 25 then
    raise exception 'Invalid order lines.' using errcode = '22023';
  end if;
  if p_delivery_method not in ('delivery_local', 'envio_nacional', 'retiro')
    or p_payment_method not in ('pago_movil', 'transferencia', 'efectivo', 'efectivo_ves', 'efectivo_usd') then
    raise exception 'Invalid delivery or payment method.' using errcode = '22023';
  end if;
  select pm.public_instructions into payment_text
    from public.payment_methods pm
    where pm.method = p_payment_method and pm.active and pm.kind = 'manual'
    for share;
  if not found or length(trim(coalesce(payment_text, ''))) < 8 then
    raise exception 'Payment method unavailable.' using errcode = '22023';
  end if;
  if p_delivery_method <> 'retiro' and jsonb_typeof(p_shipping_address) <> 'object' then
    raise exception 'Shipping address is required.' using errcode = '22023';
  end if;
  if p_delivery_method = 'envio_nacional' and length(trim(coalesce(p_shipping_agency, ''))) < 2 then
    raise exception 'Shipping agency is required.' using errcode = '22023';
  end if;

  select * into quote from public.exchange_quotes
    where id = p_quote_id and expires_at > now() order by quoted_at desc limit 1;
  if not found then raise exception 'Exchange quote expired; request a new quote.' using errcode = '22023'; end if;
  select amount_cents into shipping from public.shipping_rates where delivery_method = p_delivery_method;
  if shipping is null then raise exception 'Delivery method unavailable.' using errcode = '22023'; end if;

  for line in
    select x.variant_id, sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(variant_id text, quantity integer)
    group by x.variant_id
  loop
    line_count := line_count + 1;
    if line.quantity < 1 or line.quantity > 10 then raise exception 'Invalid quantity.' using errcode = '22023'; end if;
    select v.id as variant_id, v.product_id, v.size, v.color, v.stock,
      p.id as product_id, p.name as product_name, p.price_cents
      into variant_row
      from public.variants v join public.products p on p.id = v.product_id
      where v.id = line.variant_id and p.active for share of v, p;
    if not found or variant_row.stock < line.quantity then
      raise exception 'A selected variant is unavailable.' using errcode = 'P0002';
    end if;
    subtotal := subtotal + variant_row.price_cents * line.quantity;
    if subtotal > 2147483647 then raise exception 'Order total is too large.' using errcode = '22003'; end if;
  end loop;
  if line_count = 0 then raise exception 'Invalid order lines.' using errcode = '22023'; end if;

  total := subtotal + shipping;
  ves_total := round(total * quote.ves_per_usd)::bigint;
  insert into public.orders (
    idempotency_key, tracking_token_hash, customer, delivery_method, shipping_address, shipping_agency,
    payment_method, payment_instructions, customer_note, subtotal_cents, shipping_cents, total_cents, exchange_quote_id,
    ves_per_usd, ves_total_cents
  ) values (
    p_idempotency_key, p_tracking_token_hash, p_customer, p_delivery_method,
    case when p_delivery_method = 'retiro' then null else p_shipping_address end,
    case when p_delivery_method = 'envio_nacional' then p_shipping_agency else null end,
    p_payment_method, payment_text, nullif(trim(coalesce(p_customer_note, '')), ''), subtotal, shipping, total,
    quote.id, quote.ves_per_usd, ves_total
  ) on conflict (idempotency_key) do nothing returning * into order_row;
  if not found then
    select * into order_row from public.orders where idempotency_key = p_idempotency_key;
    if not found or order_row.tracking_token_hash <> p_tracking_token_hash then
      raise exception 'Idempotency key conflict.' using errcode = '22023';
    end if;
    return jsonb_build_object('id', order_row.id, 'code', order_row.code, 'createdAt', order_row.created_at,
      'subtotalCents', order_row.subtotal_cents, 'shippingCents', order_row.shipping_cents,
      'totalCents', order_row.total_cents, 'vesPerUsd', order_row.ves_per_usd::text,
      'vesTotalCents', order_row.ves_total_cents, 'orderStatus', order_row.order_status,
      'paymentStatus', order_row.payment_status, 'fulfillmentStatus', order_row.fulfillment_status);
  end if;

  for line in
    select x.variant_id, sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(variant_id text, quantity integer)
    group by x.variant_id
  loop
    select v.id as variant_id, v.product_id, v.size, v.color, v.stock,
      p.name as product_name, p.price_cents
      into variant_row
      from public.variants v join public.products p on p.id = v.product_id
      where v.id = line.variant_id and p.active;
    insert into public.order_items (order_id, product_id, variant_id, product_name, size, color, unit_price_cents, quantity)
    values (order_row.id, variant_row.product_id, variant_row.variant_id, variant_row.product_name,
      variant_row.size, variant_row.color, variant_row.price_cents, line.quantity);
  end loop;

  insert into public.payment_attempts (order_id, payment_method, status, note)
    values (order_row.id, p_payment_method, 'pending', 'Solicitud creada; el pago todavía no está verificado.');
  insert into public.audit_events (order_id, axis, to_status, note) values
    (order_row.id, 'order', 'awaiting_payment', 'Pedido creado.'),
    (order_row.id, 'payment', 'pending', 'Pago pendiente.'),
    (order_row.id, 'fulfillment', 'new', 'Sin preparar hasta aprobar el pago.');

  return jsonb_build_object('id', order_row.id, 'code', order_row.code, 'createdAt', order_row.created_at,
    'subtotalCents', order_row.subtotal_cents, 'shippingCents', order_row.shipping_cents,
    'totalCents', order_row.total_cents, 'vesPerUsd', order_row.ves_per_usd::text,
    'vesTotalCents', order_row.ves_total_cents, 'orderStatus', order_row.order_status,
    'paymentStatus', order_row.payment_status, 'fulfillmentStatus', order_row.fulfillment_status);
end;
$$;

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
    'paymentReference', null, 'customerNote', o.customer_note,
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

create or replace function public.admin_update_payment(
  p_order_id uuid, p_next_status text, p_note text, p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
  item record;
  available boolean := true;
  old_status text;
  next_order_status text;
begin
  if not exists (select 1 from public.admin_users a where a.user_id = p_actor_user_id and a.active) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select * into order_row from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.' using errcode = 'P0002'; end if;
  old_status := order_row.payment_status;
  if not ((old_status = 'pending' and p_next_status in ('review', 'cancelled'))
    or (old_status = 'review' and p_next_status in ('paid', 'rejected', 'cancelled'))
    or (old_status = 'rejected' and p_next_status in ('pending', 'cancelled'))) then
    raise exception 'Invalid payment transition.' using errcode = '22023';
  end if;

  if p_next_status = 'paid' then
    perform set_config('norte_moda.actor_user_id', p_actor_user_id::text, true);
    perform set_config('norte_moda.stock_reason', 'sale', true);
    perform set_config('norte_moda.order_id', order_row.id::text, true);
    for item in select oi.variant_id, sum(oi.quantity)::integer as quantity
      from public.order_items oi where oi.order_id = order_row.id group by oi.variant_id
    loop
      perform 1 from public.variants v where v.id = item.variant_id for update;
      if not found or (select v.stock from public.variants v where v.id = item.variant_id) < item.quantity then
        available := false;
      end if;
    end loop;
    if available then
      update public.variants v set stock = v.stock - i.quantity
        from (select variant_id, sum(quantity)::integer as quantity from public.order_items where order_id = order_row.id group by variant_id) i
        where v.id = i.variant_id;
      next_order_status := 'confirmed';
    else
      next_order_status := 'inventory_exception';
      insert into public.inventory_exceptions (order_id, variant_id, requested_quantity, available_quantity)
        select order_row.id, i.variant_id, i.quantity, coalesce(v.stock, 0)
        from (select variant_id, sum(quantity)::integer as quantity from public.order_items where order_id = order_row.id group by variant_id) i
        left join public.variants v on v.id = i.variant_id
        where coalesce(v.stock, 0) < i.quantity;
    end if;
  elsif p_next_status = 'cancelled' then
    next_order_status := 'cancelled';
  else
    next_order_status := order_row.order_status;
  end if;

  update public.orders set payment_status = p_next_status, order_status = next_order_status where id = order_row.id;
  insert into public.payment_attempts (order_id, payment_method, status, note, reviewed_by)
    values (order_row.id, order_row.payment_method, p_next_status, nullif(trim(p_note), ''), p_actor_user_id);
  insert into public.audit_events (order_id, axis, from_status, to_status, actor_user_id, note)
    values (order_row.id, 'payment', old_status, p_next_status, p_actor_user_id, nullif(trim(p_note), ''));
  if next_order_status is distinct from order_row.order_status then
    insert into public.audit_events (order_id, axis, from_status, to_status, actor_user_id, note)
      values (order_row.id, 'order', order_row.order_status, next_order_status, p_actor_user_id,
        case when next_order_status = 'inventory_exception' then 'Pago registrado, falta resolver inventario.' else 'Pedido actualizado tras revisar el pago.' end);
  end if;
  return jsonb_build_object('id', order_row.id, 'paymentStatus', p_next_status,
    'orderStatus', next_order_status, 'inventoryAvailable', available);
end;
$$;

create or replace function public.admin_update_fulfillment(
  p_order_id uuid, p_next_status text, p_note text, p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
  allowed boolean := false;
begin
  if not exists (select 1 from public.admin_users a where a.user_id = p_actor_user_id and a.active) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select * into order_row from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.' using errcode = 'P0002'; end if;
  if p_next_status = 'preparing' then
    allowed := order_row.fulfillment_status = 'new' and order_row.payment_status = 'paid' and order_row.order_status = 'confirmed';
  elsif p_next_status = 'shipped' then allowed := order_row.fulfillment_status = 'preparing';
  elsif p_next_status = 'delivered' then allowed := order_row.fulfillment_status = 'shipped';
  elsif p_next_status = 'cancelled' then allowed := order_row.fulfillment_status in ('new', 'preparing');
  end if;
  if not allowed then raise exception 'Invalid fulfillment transition or order not paid.' using errcode = '22023'; end if;
  update public.orders set fulfillment_status = p_next_status where id = order_row.id;
  insert into public.audit_events (order_id, axis, from_status, to_status, actor_user_id, note)
    values (order_row.id, 'fulfillment', order_row.fulfillment_status, p_next_status, p_actor_user_id, nullif(trim(p_note), ''));
  return jsonb_build_object('id', order_row.id, 'fulfillmentStatus', p_next_status);
end;
$$;

create or replace function public.admin_resolve_inventory_exception(p_order_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
  item record;
  available boolean := true;
begin
  if not exists (select 1 from public.admin_users a where a.user_id = p_actor_user_id and a.active) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select * into order_row from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.' using errcode = 'P0002'; end if;
  if order_row.payment_status <> 'paid' or order_row.order_status <> 'inventory_exception' then
    raise exception 'Order has no open inventory exception.' using errcode = '22023';
  end if;
  for item in select oi.variant_id, sum(oi.quantity)::integer as quantity
    from public.order_items oi where oi.order_id = order_row.id group by oi.variant_id
  loop
    perform 1 from public.variants v where v.id = item.variant_id for update;
    if not found or (select v.stock from public.variants v where v.id = item.variant_id) < item.quantity then
      available := false;
    end if;
  end loop;
  if not available then
    return jsonb_build_object('id', order_row.id, 'resolved', false, 'orderStatus', 'inventory_exception');
  end if;
  perform set_config('norte_moda.actor_user_id', p_actor_user_id::text, true);
  perform set_config('norte_moda.stock_reason', 'sale', true);
  perform set_config('norte_moda.order_id', order_row.id::text, true);
  update public.variants v set stock = v.stock - i.quantity
    from (select variant_id, sum(quantity)::integer as quantity from public.order_items where order_id = order_row.id group by variant_id) i
    where v.id = i.variant_id;
  update public.orders set order_status = 'confirmed' where id = order_row.id;
  update public.inventory_exceptions set resolved_at = now(), resolved_by = p_actor_user_id
    where order_id = order_row.id and resolved_at is null;
  insert into public.audit_events (order_id, axis, from_status, to_status, actor_user_id, note)
    values (order_row.id, 'order', 'inventory_exception', 'confirmed', p_actor_user_id, 'Inventario revalidado y descontado.');
  return jsonb_build_object('id', order_row.id, 'resolved', true, 'orderStatus', 'confirmed');
end;
$$;

create or replace function public.record_whatsapp_event(p_provider_event_id text, p_event_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  if length(p_provider_event_id) < 4 or length(p_provider_event_id) > 255 then
    raise exception 'Invalid provider event id.' using errcode = '22023';
  end if;
  insert into public.whatsapp_webhook_events (provider_event_id, event_type)
    values (p_provider_event_id, left(p_event_type, 80)) on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end;
$$;

revoke execute on function public.issue_demo_quote() from public, anon, authenticated;
revoke execute on function public.create_public_order(uuid, text, jsonb, text, jsonb, text, text, text, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.lookup_public_order(text, text) from public, anon, authenticated;
revoke execute on function public.admin_update_payment(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.admin_update_fulfillment(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.admin_resolve_inventory_exception(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.record_whatsapp_event(text, text) from public, anon, authenticated;
grant execute on function public.issue_demo_quote() to service_role;
grant execute on function public.create_public_order(uuid, text, jsonb, text, jsonb, text, text, text, jsonb, uuid) to service_role;
grant execute on function public.lookup_public_order(text, text) to service_role;
grant execute on function public.admin_update_payment(uuid, text, text, uuid) to service_role;
grant execute on function public.admin_update_fulfillment(uuid, text, text, uuid) to service_role;
grant execute on function public.admin_resolve_inventory_exception(uuid, uuid) to service_role;
grant execute on function public.record_whatsapp_event(text, text) to service_role;
