create or replace function public.admin_adjust_variant_stock(
  p_actor_user_id uuid,
  p_variant_id text,
  p_mode text,
  p_quantity integer,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_stock integer;
  next_stock integer;
  movement_delta integer;
  movement_reason text;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not exists (
    select 1 from public.admin_users a
    where a.user_id = p_actor_user_id and a.active
  ) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  if p_variant_id is null or p_mode is null or p_mode not in ('set', 'add', 'subtract')
    or p_quantity is null or p_quantity < 0 or p_quantity > 999999999
    or length(coalesce(p_note, '')) > 300 then
    raise exception 'Invalid inventory adjustment.' using errcode = '22023';
  end if;

  select v.stock into current_stock
    from public.variants v where v.id = p_variant_id for update;
  if not found then
    raise exception 'Variant not found.' using errcode = 'P0002';
  end if;

  next_stock := case p_mode
    when 'set' then p_quantity
    when 'add' then current_stock + p_quantity
    when 'subtract' then current_stock - p_quantity
  end;
  if next_stock < 0 then
    raise exception 'Inventory cannot become negative.' using errcode = 'P0001';
  end if;

  movement_delta := next_stock - current_stock;
  if movement_delta = 0 then
    return jsonb_build_object('variantId', p_variant_id, 'stock', current_stock, 'delta', 0);
  end if;

  movement_reason := case when p_mode = 'add' then 'receipt' else 'adjustment' end;
  perform set_config('norte_moda.actor_user_id', p_actor_user_id::text, true);
  perform set_config('norte_moda.stock_reason', movement_reason, true);
  perform set_config('norte_moda.stock_note', coalesce(clean_note, 'Ajuste desde el panel administrativo.'), true);

  update public.variants set stock = next_stock where id = p_variant_id;
  return jsonb_build_object(
    'variantId', p_variant_id,
    'stock', next_stock,
    'delta', movement_delta
  );
end;
$$;

revoke execute on function public.admin_adjust_variant_stock(uuid, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.admin_adjust_variant_stock(uuid, text, text, integer, text)
  to service_role;
