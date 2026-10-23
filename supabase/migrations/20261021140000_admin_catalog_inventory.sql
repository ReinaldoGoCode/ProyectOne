create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id text references public.variants(id) on delete set null,
  sku text not null,
  product_name text not null,
  size text not null check (size in ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único')),
  color text not null,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('receipt', 'sale', 'adjustment', 'import')),
  note text,
  order_id uuid references public.orders(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index inventory_movements_created_idx on public.inventory_movements (created_at desc);
create index inventory_movements_sku_created_idx on public.inventory_movements (sku, created_at desc);
alter table public.inventory_movements enable row level security;
revoke all on public.inventory_movements from public, anon, authenticated;
grant all on public.inventory_movements to service_role;

create or replace function public.record_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  movement_delta integer;
  movement_reason text;
  product_label text;
  actor_text text;
  actor_id uuid;
  order_text text;
  related_order_id uuid;
begin
  if tg_op = 'INSERT' then
    movement_delta := new.stock;
    movement_reason := 'receipt';
  else
    movement_delta := new.stock - old.stock;
    if movement_delta = 0 then return new; end if;
    movement_reason := nullif(current_setting('norte_moda.stock_reason', true), '');
    if movement_reason not in ('receipt', 'sale', 'adjustment', 'import') or movement_reason is null then
      movement_reason := case when movement_delta < 0 then 'sale' else 'receipt' end;
    end if;
  end if;
  if movement_delta = 0 then return new; end if;

  select p.name into product_label from public.products p where p.id = new.product_id;
  actor_text := nullif(current_setting('norte_moda.actor_user_id', true), '');
  if actor_text ~* '^[0-9a-f-]{36}$' then actor_id := actor_text::uuid; end if;
  order_text := nullif(current_setting('norte_moda.order_id', true), '');
  if order_text ~* '^[0-9a-f-]{36}$' then related_order_id := order_text::uuid; end if;

  insert into public.inventory_movements (
    variant_id, sku, product_name, size, color, delta, reason, note, order_id, actor_user_id
  ) values (
    new.id,
    new.sku,
    coalesce(product_label, 'Producto'),
    new.size,
    new.color,
    movement_delta,
    movement_reason,
    coalesce(nullif(current_setting('norte_moda.stock_note', true), ''),
      case when movement_reason = 'sale' then 'Existencias descontadas por venta.' else 'Movimiento de inventario.' end),
    related_order_id,
    actor_id
  );
  return new;
end;
$$;

drop trigger if exists variants_record_inventory_insert on public.variants;
create trigger variants_record_inventory_insert
  after insert on public.variants
  for each row execute function public.record_inventory_movement();

drop trigger if exists variants_record_inventory_update on public.variants;
create trigger variants_record_inventory_update
  after update of stock on public.variants
  for each row execute function public.record_inventory_movement();
revoke execute on function public.record_inventory_movement() from public, anon, authenticated;
grant execute on function public.record_inventory_movement() to service_role;

create or replace function public.admin_apply_catalog_import(
  p_actor_user_id uuid,
  p_products jsonb,
  p_variants jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  product_item jsonb;
  variant_item jsonb;
  product_id text;
  product_slug text;
  product_name text;
  category_id text;
  product_description text;
  product_composition text;
  product_care text;
  product_price integer;
  product_active boolean;
  image_url text;
  image_alt text;
  variant_id text;
  variant_size text;
  variant_color text;
  variant_sku text;
  variant_stock integer;
  old_stock integer;
  old_sku text;
  old_product_id text;
  created_products integer := 0;
  created_variants integer := 0;
  changed_variants integer := 0;
begin
  if not exists (
    select 1 from public.admin_users a
    where a.user_id = p_actor_user_id and a.active
  ) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_products) is distinct from 'array' or jsonb_typeof(p_variants) is distinct from 'array' then
    raise exception 'Import exceeds the supported size.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_products) > 5000 or jsonb_array_length(p_variants) > 5000 then
    raise exception 'Import exceeds the supported size.' using errcode = '22023';
  end if;
  if (select count(distinct value->>'slug') from jsonb_array_elements(p_products)) <> jsonb_array_length(p_products)
    or (select count(distinct value->>'id') from jsonb_array_elements(p_variants)) <> jsonb_array_length(p_variants)
    or (select count(distinct upper(value->>'sku')) from jsonb_array_elements(p_variants)) <> jsonb_array_length(p_variants)
    or (select count(distinct (value->>'productId') || '|' || (value->>'size') || '|' || lower(value->>'color'))
      from jsonb_array_elements(p_variants)) <> jsonb_array_length(p_variants) then
    raise exception 'Duplicate product or variant in import.' using errcode = '22023';
  end if;
  perform set_config('norte_moda.actor_user_id', p_actor_user_id::text, true);
  perform set_config('norte_moda.stock_reason', 'import', true);
  perform set_config('norte_moda.stock_note', 'Importación administrativa de catálogo.', true);

  for product_item in select value from jsonb_array_elements(p_products)
  loop
    product_id := product_item->>'id';
    product_slug := product_item->>'slug';
    product_name := btrim(product_item->>'name');
    category_id := product_item->>'categoryId';
    product_description := coalesce(product_item->>'description', '');
    product_composition := coalesce(product_item->>'composition', '');
    product_care := coalesce(product_item->>'care', '');
    image_url := product_item->>'imageUrl';
    image_alt := coalesce(product_item->>'imageAlt', '');

    if product_id is null or product_id <> product_slug
      or product_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or length(product_name) < 2 or length(product_name) > 180
      or category_id is null or not exists (select 1 from public.categories c where c.id = category_id)
      or length(product_description) > 5000 or length(product_composition) > 500
      or length(product_care) > 1000 or image_url is null or length(image_url) > 2048
      or length(image_alt) > 300 or jsonb_typeof(product_item->'priceCents') is distinct from 'number'
      or (product_item->>'priceCents') !~ '^[1-9][0-9]{0,8}$'
      or jsonb_typeof(product_item->'active') is distinct from 'boolean' then
      raise exception 'Invalid product data.' using errcode = '22023';
    end if;
    product_price := (product_item->>'priceCents')::integer;
    product_active := (product_item->>'active')::boolean;

    if exists (select 1 from public.products p where p.id = product_id) then
      update public.products set
        name = product_name,
        category_id = category_id,
        description = product_description,
        composition = product_composition,
        care = product_care,
        price_cents = product_price,
        image_url = image_url,
        image_alt = image_alt,
        active = product_active
      where id = product_id;
    else
      insert into public.products (
        id, slug, name, category_id, description, composition, care,
        price_cents, image_url, image_alt, active
      ) values (
        product_id, product_slug, product_name, category_id, product_description,
        product_composition, product_care, product_price, image_url, image_alt, product_active
      );
      created_products := created_products + 1;
    end if;
  end loop;

  for variant_item in select value from jsonb_array_elements(p_variants)
  loop
    variant_id := variant_item->>'id';
    product_id := variant_item->>'productId';
    variant_size := variant_item->>'size';
    variant_color := btrim(variant_item->>'color');
    variant_sku := upper(btrim(variant_item->>'sku'));
    if variant_id is null or variant_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or product_id is null or not exists (select 1 from public.products p where p.id = product_id)
      or variant_size is null or variant_size not in ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único')
      or variant_color = '' or length(variant_color) > 80
      or variant_sku = '' or length(variant_sku) > 100
      or jsonb_typeof(variant_item->'stock') is distinct from 'number'
      or (variant_item->>'stock') !~ '^(0|[1-9][0-9]{0,8})$' then
      raise exception 'Invalid variant data.' using errcode = '22023';
    end if;
    variant_stock := (variant_item->>'stock')::integer;

    select v.stock, v.sku, v.product_id into old_stock, old_sku, old_product_id
      from public.variants v where v.id = variant_id for update;
    if not found then old_stock := null; old_sku := null; old_product_id := null; end if;
    if old_stock is null then
      if variant_item->'expectedStock' is distinct from 'null'::jsonb then
        raise exception 'Inventory changed after preview. Reload and retry.' using errcode = '40001';
      end if;
    else
      if jsonb_typeof(variant_item->'expectedStock') is distinct from 'number'
        or (variant_item->>'expectedStock') !~ '^(0|[1-9][0-9]{0,8})$' then
        raise exception 'Inventory changed after preview. Reload and retry.' using errcode = '40001';
      end if;
      if (variant_item->>'expectedStock')::integer <> old_stock then
        raise exception 'Inventory changed after preview. Reload and retry.' using errcode = '40001';
      end if;
    end if;
    if exists (
      select 1 from public.variants v
      where v.product_id = product_id and v.size = variant_size
        and lower(v.color) = lower(variant_color) and v.id <> variant_id
    ) then
      raise exception 'Variant size and color already exist.' using errcode = '23505';
    end if;
    if old_sku is null and exists (select 1 from public.variants v where upper(v.sku) = variant_sku) then
      raise exception 'SKU already belongs to another variant.' using errcode = '23505';
    end if;
    if old_sku is not null and old_product_id <> product_id then
      raise exception 'A SKU cannot be moved to another product.' using errcode = '22023';
    end if;

    insert into public.variants (id, product_id, size, color, sku, stock)
      values (variant_id, product_id, variant_size, variant_color, variant_sku, variant_stock)
      on conflict (id) do update set
        product_id = excluded.product_id,
        size = excluded.size,
        color = excluded.color,
        sku = excluded.sku,
        stock = excluded.stock;

    if old_stock is null then
      created_variants := created_variants + 1;
    end if;
    if variant_stock <> coalesce(old_stock, 0) then
      changed_variants := changed_variants + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'createdProducts', created_products,
    'createdVariants', created_variants,
    'changedVariants', changed_variants
  );
end;
$$;

revoke execute on function public.admin_apply_catalog_import(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.admin_apply_catalog_import(uuid, jsonb, jsonb) to service_role;
