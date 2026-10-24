-- Catálogo ficticio autorizado para demostración visual en el proyecto remoto.
-- Todos los nombres/precios están marcados DEMO y las variantes tienen stock 0.
-- No se debe usar este contenido como inventario ni precio de venta real.
begin;

insert into public.categories (id, slug, name, description) values
  ('demo-superiores', 'demo-superiores', 'DEMO · Blusas y tops', 'Categoría ficticia de demostración.'),
  ('demo-vestidos', 'demo-vestidos', 'DEMO · Vestidos', 'Categoría ficticia de demostración.'),
  ('demo-faldas', 'demo-faldas', 'DEMO · Faldas', 'Categoría ficticia de demostración.'),
  ('demo-pantalones', 'demo-pantalones', 'DEMO · Pantalones', 'Categoría ficticia de demostración.'),
  ('demo-chaquetas', 'demo-chaquetas', 'DEMO · Chaquetas', 'Categoría ficticia de demostración.'),
  ('demo-conjuntos', 'demo-conjuntos', 'DEMO · Conjuntos', 'Categoría ficticia de demostración.')
on conflict (id) do nothing;

with styles (style_slug, garment, model_prefix, category_id, base_price_cents) as (
  values
    ('blusa', 'Blusa', 'Satén', 'demo-superiores', 2400),
    ('camisa', 'Camisa', 'Lino', 'demo-superiores', 3200),
    ('camiseta', 'Camiseta', 'Algodón', 'demo-superiores', 1800),
    ('vestido', 'Vestido', 'Midi', 'demo-vestidos', 4800),
    ('falda', 'Falda', 'Plisada', 'demo-faldas', 3600),
    ('pantalon', 'Pantalón', 'Recto', 'demo-pantalones', 4200),
    ('chaqueta', 'Chaqueta', 'Ligera', 'demo-chaquetas', 6500),
    ('top', 'Top', 'Acanalado', 'demo-superiores', 2200),
    ('short', 'Short', 'Casual', 'demo-pantalones', 2900),
    ('conjunto', 'Conjunto', 'Dos piezas', 'demo-conjuntos', 7200)
), models (model_slug, model_name, price_delta) as (
  values
    ('clasico', 'Clásico', 0),
    ('costa', 'Costa', 100),
    ('luna', 'Luna', 200),
    ('brisa', 'Brisa', 300),
    ('urbano', 'Urbano', 400)
), product_rows as (
  select
    'demo-' || styles.style_slug || '-' || models.model_slug as id,
    'demo-' || styles.style_slug || '-' || models.model_slug as slug,
    'DEMO · ' || styles.garment || ' ' || styles.model_prefix || ' ' || models.model_name as name,
    styles.category_id,
    'Producto ficticio de demostración. No es inventario real y no está disponible para compra.' as description,
    'Composición de muestra; confirmar la composición real antes de ofrecer esta prenda.' as composition,
    'Instrucciones de cuidado de demostración; confirmar antes de vender.' as care,
    styles.base_price_cents + models.price_delta as price_cents,
    'https://reinaldogocode.github.io/ProyectOne/images/products/placeholder.svg' as image_url,
    'Imagen genérica de prenda de demostración, no representa el producto ficticio.' as image_alt
  from styles cross join models
)
insert into public.products (
  id, slug, name, category_id, description, composition, care,
  price_cents, image_url, image_alt, active
)
select
  id, slug, name, category_id, description, composition, care,
  price_cents, image_url, image_alt, true
from product_rows
on conflict (id) do nothing;

insert into public.variants (id, product_id, size, color, sku, stock)
select
  'demo-variant-' || p.id,
  p.id,
  'Único',
  'Muestra',
  upper('DEMO-' || replace(p.slug, 'demo-', '')),
  0
from public.products p
where p.id like 'demo-%'
  and p.name like 'DEMO · %'
on conflict (id) do nothing;

commit;
