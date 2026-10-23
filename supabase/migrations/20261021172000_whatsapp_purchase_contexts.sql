create table public.whatsapp_purchase_contexts (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  variant_id text not null references public.variants(id),
  quantity integer not null check (quantity between 1 and 10),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_phone text check (claimed_phone is null or claimed_phone ~ '^[0-9]{8,15}$'),
  claimed_at timestamptz,
  check (expires_at > created_at),
  check ((claimed_phone is null) = (claimed_at is null))
);

create index whatsapp_purchase_contexts_expiry_idx
  on public.whatsapp_purchase_contexts (expires_at);

alter table public.whatsapp_purchase_contexts enable row level security;
revoke all on public.whatsapp_purchase_contexts from public, anon, authenticated;
grant all on public.whatsapp_purchase_contexts to service_role;

create or replace function public.create_whatsapp_purchase_context(
  p_token_hash text,
  p_variant_id text,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  variant_row record;
  context_row public.whatsapp_purchase_contexts;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_variant_id is null or length(p_variant_id) < 1 or length(p_variant_id) > 120
    or p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'Invalid WhatsApp purchase context.' using errcode = '22023';
  end if;

  select v.id as variant_id, v.size, v.color, v.stock,
      p.slug as product_slug, p.name as product_name, p.price_cents, p.active
    into variant_row
    from public.variants v
    join public.products p on p.id = v.product_id
    where v.id = p_variant_id
    for share of v, p;
  if not found or not variant_row.active or variant_row.stock < p_quantity then
    raise exception 'Selected variant is unavailable.' using errcode = 'P0002';
  end if;

  delete from public.whatsapp_purchase_contexts
    where id in (
      select id from public.whatsapp_purchase_contexts
      where expires_at < now() - interval '30 days'
      order by expires_at
      limit 100
    );

  insert into public.whatsapp_purchase_contexts (token_hash, variant_id, quantity, expires_at)
    values (p_token_hash, p_variant_id, p_quantity, now() + interval '24 hours')
    returning * into context_row;

  return jsonb_build_object(
    'productSlug', variant_row.product_slug,
    'productName', variant_row.product_name,
    'size', variant_row.size,
    'color', variant_row.color,
    'quantity', context_row.quantity,
    'unitPriceCents', variant_row.price_cents,
    'stock', variant_row.stock,
    'available', true,
    'expiresAt', context_row.expires_at
  );
end;
$$;

create or replace function public.claim_whatsapp_purchase_context(
  p_token_hash text,
  p_sender_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  context_row public.whatsapp_purchase_contexts;
  variant_row record;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_sender_phone is null or p_sender_phone !~ '^[0-9]{8,15}$' then
    raise exception 'Invalid WhatsApp purchase context claim.' using errcode = '22023';
  end if;

  select * into context_row
    from public.whatsapp_purchase_contexts
    where token_hash = p_token_hash and expires_at > now()
    for update;
  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;
  if context_row.claimed_phone is not null and context_row.claimed_phone <> p_sender_phone then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if context_row.claimed_phone is null then
    update public.whatsapp_purchase_contexts
      set claimed_phone = p_sender_phone, claimed_at = now()
      where id = context_row.id
      returning * into context_row;
  end if;

  select v.id as variant_id, v.size, v.color, v.stock,
      p.slug as product_slug, p.name as product_name, p.price_cents, p.active
    into variant_row
    from public.variants v
    join public.products p on p.id = v.product_id
    where v.id = context_row.variant_id
    for share of v, p;
  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  return jsonb_build_object(
    'status', case when variant_row.active and variant_row.stock >= context_row.quantity
      then 'available' else 'unavailable' end,
    'productSlug', variant_row.product_slug,
    'productName', variant_row.product_name,
    'size', variant_row.size,
    'color', variant_row.color,
    'quantity', context_row.quantity,
    'unitPriceCents', variant_row.price_cents,
    'stock', variant_row.stock,
    'available', variant_row.active and variant_row.stock >= context_row.quantity,
    'expiresAt', context_row.expires_at
  );
end;
$$;

revoke execute on function public.create_whatsapp_purchase_context(text, text, integer) from public, anon, authenticated;
revoke execute on function public.claim_whatsapp_purchase_context(text, text) from public, anon, authenticated;
grant execute on function public.create_whatsapp_purchase_context(text, text, integer) to service_role;
grant execute on function public.claim_whatsapp_purchase_context(text, text) to service_role;
