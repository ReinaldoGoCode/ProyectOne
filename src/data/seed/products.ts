import type { CategoryId, Product, Size, Variant } from '@/domain/types'

/**
 * Catálogo ficticio de la tienda.
 *
 * Cada producto se declara una sola vez con sus colores y el stock por talla.
 * El constructor expande esa declaración a variantes con id y SKU estables,
 * para no escribir a mano más de ochenta combinaciones.
 */

interface SizeStock {
  readonly size: Size
  readonly stock: number
}

interface ColorStock {
  readonly color: string
  readonly sizes: readonly SizeStock[]
}

interface ProductInput {
  /** Prefijo corto para el SKU, ej. `CAM01`. */
  readonly code: string
  readonly slug: string
  readonly name: string
  readonly categoryId: CategoryId
  readonly description: string
  readonly composition: string
  readonly care: string
  readonly priceCents: number
  readonly active: boolean
  readonly createdAt: string
  readonly colors: readonly ColorStock[]
}

interface SeedEntry {
  readonly product: Product
  readonly variants: readonly Variant[]
}

const PLACEHOLDER_IMAGE = '/images/products/placeholder.svg'

/** Normaliza a mayúsculas sin acentos ni separadores: `Azul marino` → `AZULMARINO`. */
function compact(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
}

function buildEntry(input: ProductInput): SeedEntry {
  const product: Product = {
    id: input.slug,
    slug: input.slug,
    name: input.name,
    categoryId: input.categoryId,
    description: input.description,
    composition: input.composition,
    care: input.care,
    priceCents: input.priceCents,
    imageUrl: PLACEHOLDER_IMAGE,
    imageAlt: `${input.name}: imagen de referencia de la prenda`,
    active: input.active,
    createdAt: input.createdAt,
  }

  const variants: Variant[] = input.colors.flatMap(({ color, sizes }) =>
    sizes.map(({ size, stock }) => ({
      id: `${product.slug}-${compact(color).toLowerCase()}-${compact(size).toLowerCase()}`,
      productId: product.id,
      size,
      color,
      sku: `NM-${input.code}-${compact(color)}-${compact(size)}`,
      stock,
    })),
  )

  return { product, variants }
}

const SEED_ENTRIES: readonly SeedEntry[] = [
  buildEntry({
    code: 'CAM01',
    slug: 'camisa-lino-margarita',
    name: 'Camisa de lino Margarita',
    categoryId: 'camisas',
    description:
      'Camisa fresca de lino para el calor de la costa. Corte recto y manga larga recogible.',
    composition: '55 % lino, 45 % algodón.',
    care: 'Lavar a mano con agua fría. Secar a la sombra. Planchar a temperatura media.',
    priceCents: 2800,
    active: true,
    createdAt: '2026-08-03T14:00:00.000Z',
    colors: [
      {
        color: 'Blanco',
        sizes: [
          { size: 'S', stock: 4 },
          { size: 'M', stock: 6 },
          { size: 'L', stock: 5 },
          { size: 'XL', stock: 2 },
        ],
      },
      {
        color: 'Arena',
        sizes: [
          { size: 'S', stock: 3 },
          { size: 'M', stock: 0 },
          { size: 'L', stock: 4 },
          { size: 'XL', stock: 1 },
        ],
      },
      {
        color: 'Negro',
        sizes: [
          { size: 'S', stock: 2 },
          { size: 'M', stock: 3 },
          { size: 'L', stock: 2 },
          { size: 'XL', stock: 0 },
        ],
      },
    ],
  }),
  buildEntry({
    code: 'CAM02',
    slug: 'camisa-oversize-catuaro',
    name: 'Camisa oversize Catuaro',
    categoryId: 'camisas',
    description: 'Camisa oversize de caída suave, pensada para usar suelta o anudada.',
    composition: '100 % algodón.',
    care: 'Lavar en frío con colores similares. No usar secadora.',
    priceCents: 3200,
    active: true,
    createdAt: '2026-08-21T14:00:00.000Z',
    colors: [
      {
        color: 'Celeste',
        sizes: [
          { size: 'S', stock: 3 },
          { size: 'M', stock: 5 },
          { size: 'L', stock: 4 },
          { size: 'XL', stock: 2 },
        ],
      },
      {
        color: 'Blanco',
        sizes: [
          { size: 'S', stock: 2 },
          { size: 'M', stock: 4 },
          { size: 'L', stock: 3 },
          { size: 'XL', stock: 1 },
        ],
      },
    ],
  }),
  buildEntry({
    code: 'FRA01',
    slug: 'franela-pique-coro',
    name: 'Franela piqué Coro',
    categoryId: 'camisas',
    description: 'Franela de piqué con cuello camisero. Básico de todos los días.',
    composition: '95 % algodón, 5 % elastano.',
    care: 'Lavar a máquina en ciclo suave. Secar a la sombra.',
    priceCents: 2200,
    active: true,
    createdAt: '2026-09-02T14:00:00.000Z',
    colors: [
      {
        color: 'Gris',
        sizes: [
          { size: 'S', stock: 5 },
          { size: 'M', stock: 7 },
          { size: 'L', stock: 6 },
          { size: 'XL', stock: 3 },
        ],
      },
      {
        color: 'Azul marino',
        sizes: [
          { size: 'S', stock: 4 },
          { size: 'M', stock: 6 },
          { size: 'L', stock: 5 },
          { size: 'XL', stock: 2 },
        ],
      },
    ],
  }),
  buildEntry({
    code: 'VES01',
    slug: 'vestido-midi-canaima',
    name: 'Vestido midi Canaima',
    categoryId: 'vestidos',
    description: 'Vestido midi con cintura marcada y falda fluida.',
    composition: '70 % viscosa, 30 % lino.',
    care: 'Lavar a mano. No retorcer. Planchar del revés.',
    priceCents: 3800,
    active: true,
    createdAt: '2026-08-12T14:00:00.000Z',
    colors: [
      {
        color: 'Terracota',
        sizes: [
          { size: 'XS', stock: 2 },
          { size: 'S', stock: 4 },
          { size: 'M', stock: 3 },
          { size: 'L', stock: 1 },
        ],
      },
      {
        color: 'Negro',
        sizes: [
          { size: 'XS', stock: 1 },
          { size: 'S', stock: 3 },
          { size: 'M', stock: 4 },
          { size: 'L', stock: 2 },
        ],
      },
      {
        color: 'Oliva',
        sizes: [
          { size: 'XS', stock: 0 },
          { size: 'S', stock: 2 },
          { size: 'M', stock: 2 },
          { size: 'L', stock: 0 },
        ],
      },
    ],
  }),
  buildEntry({
    code: 'VES02',
    slug: 'vestido-corto-paraguana',
    name: 'Vestido corto Paraguaná',
    categoryId: 'vestidos',
    description: 'Vestido corto de tirantes ajustables para el día a día.',
    composition: '100 % viscosa.',
    care: 'Lavar a mano con agua fría. Secar en plano.',
    priceCents: 3400,
    active: true,
    createdAt: '2026-09-10T14:00:00.000Z',
    colors: [
      {
        color: 'Floral',
        sizes: [
          { size: 'S', stock: 3 },
          { size: 'M', stock: 4 },
          { size: 'L', stock: 2 },
        ],
      },
      {
        color: 'Negro',
        sizes: [
          { size: 'S', stock: 2 },
          { size: 'M', stock: 3 },
          { size: 'L', stock: 1 },
        ],
      },
    ],
  }),
  buildEntry({
    code: 'VES03',
    slug: 'vestido-lino-isla',
    name: 'Vestido de lino Isla',
    categoryId: 'vestidos',
    description: 'Vestido largo de lino, escote cuadrado y bolsillos laterales. Agotado por ahora.',
    composition: '100 % lino.',
    care: 'Lavar a mano. Planchar húmedo.',
    priceCents: 4200,
    active: true,
    createdAt: '2026-07-15T14:00:00.000Z',
    colors: [
      {
        color: 'Arena',
        sizes: [
          { size: 'S', stock: 0 },
          { size: 'M', stock: 0 },
          { size: 'L', stock: 0 },
          { size: 'XL', stock: 0 },
        ],
      },
      {
        color: 'Azul cielo',
        sizes: [
          { size: 'S', stock: 0 },
          { size: 'M', stock: 0 },
          { size: 'L', stock: 0 },
          { size: 'XL', stock: 0 },
        ],
      },
    ],
  }),
  buildEntry({
    code: 'PAN01',
    slug: 'pantalon-palazzo-merida',
    name: 'Pantalón palazzo Mérida',
    categoryId: 'pantalones',
    description: 'Pantalón palazzo de cintura alta y pierna ancha.',
    composition: '100 % poliéster.',
    care: 'Lavar a máquina en frío. Colgar para secar.',
    priceCents: 3000,
    active: true,
    createdAt: '2026-08-28T14:00:00.000Z',
    colors: [
      {
        color: 'Negro',
        sizes: [
          { size: 'S', stock: 3 },
          { size: 'M', stock: 5 },
          { size: 'L', stock: 4 },
          { size: 'XL', stock: 2 },
        ],
      },
      {
        color: 'Beige',
        sizes: [
          { size: 'S', stock: 2 },
          { size: 'M', stock: 4 },
          { size: 'L', stock: 3 },
          { size: 'XL', stock: 1 },
        ],
      },
    ],
  }),
  buildEntry({
    code: 'PAN02',
    slug: 'pantalon-cargo-caracas',
    name: 'Pantalón cargo Caracas',
    categoryId: 'pantalones',
    description: 'Pantalón cargo con bolsillos laterales y puños ajustables.',
    composition: '98 % algodón, 2 % elastano.',
    care: 'Lavar del revés. No usar blanqueador.',
    priceCents: 3600,
    active: true,
    createdAt: '2026-09-18T14:00:00.000Z',
    colors: [
      {
        color: 'Khaki',
        sizes: [
          { size: 'S', stock: 4 },
          { size: 'M', stock: 5 },
          { size: 'L', stock: 3 },
          { size: 'XL', stock: 1 },
        ],
      },
      {
        color: 'Negro',
        sizes: [
          { size: 'S', stock: 3 },
          { size: 'M', stock: 4 },
          { size: 'L', stock: 4 },
          { size: 'XL', stock: 2 },
        ],
      },
    ],
  }),
  buildEntry({
    code: 'PAN03',
    slug: 'jean-recto-maracaibo',
    name: 'Jean recto Maracaibo',
    categoryId: 'pantalones',
    description: 'Jean de tiro alto y pierna recta, con poco elastano.',
    composition: '99 % algodón, 1 % elastano.',
    care: 'Lavar en frío del revés. Secar a la sombra.',
    priceCents: 4000,
    active: true,
    createdAt: '2026-09-25T14:00:00.000Z',
    colors: [
      {
        color: 'Azul medio',
        sizes: [
          { size: 'S', stock: 2 },
          { size: 'M', stock: 4 },
          { size: 'L', stock: 5 },
          { size: 'XL', stock: 3 },
        ],
      },
      {
        color: 'Negro',
        sizes: [
          { size: 'S', stock: 1 },
          { size: 'M', stock: 3 },
          { size: 'L', stock: 2 },
          { size: 'XL', stock: 1 },
        ],
      },
    ],
  }),
  buildEntry({
    code: 'PAN04',
    slug: 'pantalon-wide-leg-valencia',
    name: 'Pantalón wide leg Valencia',
    categoryId: 'pantalones',
    description: 'Pantalón wide leg de lino. Fuera de temporada por ahora.',
    composition: '100 % lino.',
    care: 'Lavar a mano.',
    priceCents: 3300,
    active: false,
    createdAt: '2026-06-30T14:00:00.000Z',
    colors: [
      {
        color: 'Negro',
        sizes: [
          { size: 'S', stock: 0 },
          { size: 'M', stock: 0 },
          { size: 'L', stock: 0 },
          { size: 'XL', stock: 0 },
        ],
      },
      {
        color: 'Arena',
        sizes: [
          { size: 'S', stock: 0 },
          { size: 'M', stock: 0 },
          { size: 'L', stock: 0 },
          { size: 'XL', stock: 0 },
        ],
      },
    ],
  }),
]

export const seedProducts: readonly Product[] = SEED_ENTRIES.map((entry) => entry.product)

export const seedVariants: readonly Variant[] = SEED_ENTRIES.flatMap((entry) => entry.variants)
