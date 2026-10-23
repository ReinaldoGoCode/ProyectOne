create index if not exists orders_dashboard_period_idx on public.orders (created_at desc);
create index if not exists orders_dashboard_backlog_idx on public.orders (fulfillment_status)
  where order_status = 'confirmed' and payment_status = 'paid'
    and fulfillment_status in ('new', 'preparing');

create or replace function public.admin_dashboard_summary(
  p_actor_user_id uuid,
  p_from timestamptz,
  p_to_exclusive timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.admin_users a
    where a.user_id = p_actor_user_id and a.active
  ) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if p_from is null or p_to_exclusive is null or p_from >= p_to_exclusive
    or p_to_exclusive - p_from > interval '366 days' then
    raise exception 'Invalid dashboard date range.' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to_exclusive),
    -- Received includes every order created in the selected dates, even if later canceled.
    'ordersReceived', (
      select count(*) from public.orders o
      where o.created_at >= p_from and o.created_at < p_to_exclusive
    ),
    -- A sale requires both a verified payment and a confirmed order; cancellations are excluded.
    'confirmedSalesCount', (
      select count(*) from public.orders o
      where o.created_at >= p_from and o.created_at < p_to_exclusive
        and o.payment_status = 'paid' and o.order_status = 'confirmed'
    ),
    'confirmedSalesCents', coalesce((
      select sum(o.total_cents)::bigint from public.orders o
      where o.created_at >= p_from and o.created_at < p_to_exclusive
        and o.payment_status = 'paid' and o.order_status = 'confirmed'
    ), 0),
    -- Pending and review payments remain liabilities, never confirmed sales.
    'pendingPaymentCount', (
      select count(*) from public.orders o
      where o.created_at >= p_from and o.created_at < p_to_exclusive
        and o.order_status <> 'cancelled' and o.payment_status in ('pending', 'review')
    ),
    'pendingPaymentCents', coalesce((
      select sum(o.total_cents)::bigint from public.orders o
      where o.created_at >= p_from and o.created_at < p_to_exclusive
        and o.order_status <> 'cancelled' and o.payment_status in ('pending', 'review')
    ), 0),
    -- Paid balance is admin-approved collection; unresolved inventory exceptions count here,
    -- while canceled orders are excluded because this schema has no refund ledger.
    'paidBalanceCents', coalesce((
      select sum(o.total_cents)::bigint from public.orders o
      where o.created_at >= p_from and o.created_at < p_to_exclusive
        and o.payment_status = 'paid' and o.order_status <> 'cancelled'
    ), 0),
    'pendingBalanceCents', coalesce((
      select sum(o.total_cents)::bigint from public.orders o
      where o.created_at >= p_from and o.created_at < p_to_exclusive
        and o.order_status <> 'cancelled' and o.payment_status in ('pending', 'review')
    ), 0),
    -- The operational preparation backlog is current and independent of the selected period.
    'preparationBacklogCount', (
      select count(*) from public.orders o
      where o.order_status = 'confirmed' and o.payment_status = 'paid'
        and o.fulfillment_status in ('new', 'preparing')
    ),
    -- Catalog and inventory values are current snapshots, independent of the selected period.
    'activeProductCount', (
      select count(*) from public.products p where p.active
    ),
    'availableVariantCount', (
      select count(*) from public.variants v
      join public.products p on p.id = v.product_id
      where p.active and v.stock > 0
    ),
    'lowStockVariantCount', (
      select count(*) from public.variants v
      join public.products p on p.id = v.product_id
      where p.active and v.stock <= 3
    ),
    'lowStockVariants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'variantId', ranked.id,
        'sku', ranked.sku,
        'productName', ranked.product_name,
        'size', ranked.size,
        'color', ranked.color,
        'stock', ranked.stock
      ) order by ranked.stock, ranked.product_name, ranked.sku)
      from (
        select v.id, v.sku, p.name as product_name, v.size, v.color, v.stock
        from public.variants v
        join public.products p on p.id = v.product_id
        where p.active and v.stock <= 3
        order by v.stock, p.name, v.sku
        limit 10
      ) ranked
    ), '[]'::jsonb),
    'topSellers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'productId', ranked.product_id,
        'productName', ranked.product_name,
        'quantity', ranked.quantity,
        'revenueCents', ranked.revenue_cents
      ) order by ranked.quantity desc, ranked.revenue_cents desc, ranked.product_name)
      from (
        select oi.product_id, oi.product_name,
          sum(oi.quantity)::bigint as quantity,
          sum(oi.unit_price_cents::bigint * oi.quantity)::bigint as revenue_cents
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where o.created_at >= p_from and o.created_at < p_to_exclusive
          and o.payment_status = 'paid' and o.order_status = 'confirmed'
        group by oi.product_id, oi.product_name
        order by sum(oi.quantity) desc,
          sum(oi.unit_price_cents::bigint * oi.quantity) desc,
          oi.product_name
        limit 5
      ) ranked
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.admin_dashboard_summary(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.admin_dashboard_summary(uuid, timestamptz, timestamptz)
  to service_role;
