import { createServer } from 'vite'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const vite = await createServer({
  configFile: resolve(process.cwd(), 'vite.config.ts'),
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
})

try {
  const { seedCatalog } = await vite.ssrLoadModule('/src/data/seed/index.ts')
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
  const categories = seedCatalog.categories.map(
    (category) =>
      `(${quote(category.id)}, ${quote(category.slug)}, ${quote(category.name)}, ${quote(category.description)})`,
  )
  const products = seedCatalog.products.map(
    (product) =>
      `(${quote(product.id)}, ${quote(product.slug)}, ${quote(product.name)}, ${quote(product.categoryId)}, ${quote(product.description)}, ${quote(product.composition)}, ${quote(product.care)}, ${product.priceCents}, ${quote(product.imageUrl)}, ${quote(product.imageAlt)}, ${product.active}, ${quote(product.createdAt)})`,
  )
  const variants = seedCatalog.variants.map(
    (variant) =>
      `(${quote(variant.id)}, ${quote(variant.productId)}, ${quote(variant.size)}, ${quote(variant.color)}, ${quote(variant.sku)}, ${variant.stock})`,
  )
  const sql = [
    '-- Generated from src/data/seed. Fictional demo catalog and inventory; re-run only on a fresh local database.',
    `insert into public.categories (id, slug, name, description) values\n${categories.join(',\n')}\non conflict (id) do nothing;`,
    `insert into public.products (id, slug, name, category_id, description, composition, care, price_cents, image_url, image_alt, active, created_at) values\n${products.join(',\n')}\non conflict (id) do nothing;`,
    `insert into public.variants (id, product_id, size, color, sku, stock) values\n${variants.join(',\n')}\non conflict (id) do nothing;`,
    '',
  ].join('\n\n')
  await writeFile(resolve(process.cwd(), 'supabase/seed.sql'), sql, 'utf8')
  process.stdout.write(
    `Wrote Supabase demo seed: ${seedCatalog.products.length} products, ${seedCatalog.variants.length} variants.\n`,
  )
} finally {
  await vite.close()
}
