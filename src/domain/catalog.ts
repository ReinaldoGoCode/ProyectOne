import type { Catalog, CategoryId, Product } from './types'

export type CatalogSort = 'novedades' | 'precio-asc' | 'precio-desc'

export const DEFAULT_CATALOG_SORT: CatalogSort = 'novedades'

const SORTS: readonly CatalogSort[] = ['novedades', 'precio-asc', 'precio-desc']

export function isCatalogSort(value: string | null): value is CatalogSort {
  return value !== null && SORTS.some((sort) => sort === value)
}

export interface CatalogFilters {
  readonly categoryId: CategoryId | null
  readonly search: string
  readonly sort: CatalogSort
}

/** Minúsculas y sin acentos: `Paraguaná` y `paraguana` deben encontrarse. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const COMPARATORS: Readonly<Record<CatalogSort, (a: Product, b: Product) => number>> = {
  novedades: (a, b) => b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name, 'es'),
  'precio-asc': (a, b) => a.priceCents - b.priceCents || a.name.localeCompare(b.name, 'es'),
  'precio-desc': (a, b) => b.priceCents - a.priceCents || a.name.localeCompare(b.name, 'es'),
}

/**
 * Filtra y ordena el catálogo activo.
 *
 * La búsqueda recorre nombre, descripción, categoría y colores de las
 * variantes. Todos los términos deben aparecer (AND), así `camisa lino`
 * encuentra la camisa de lino y no cualquier camisa.
 */
export function filterCatalog(catalog: Catalog, filters: CatalogFilters): readonly Product[] {
  const categoryNames = new Map(catalog.categories.map((category) => [category.id, category.name]))

  const colorsByProduct = new Map<string, string[]>()

  for (const variant of catalog.variants) {
    const colors = colorsByProduct.get(variant.productId) ?? []

    if (!colors.includes(variant.color)) {
      colors.push(variant.color)
    }

    colorsByProduct.set(variant.productId, colors)
  }

  const terms = normalize(filters.search)
    .split(/\s+/)
    .filter((term) => term.length > 0)

  const filtered = catalog.products.filter((product) => {
    if (!product.active) {
      return false
    }

    if (filters.categoryId !== null && product.categoryId !== filters.categoryId) {
      return false
    }

    if (terms.length === 0) {
      return true
    }

    const haystack = normalize(
      [
        product.name,
        product.description,
        categoryNames.get(product.categoryId) ?? '',
        ...(colorsByProduct.get(product.id) ?? []),
      ].join(' '),
    )

    return terms.every((term) => haystack.includes(term))
  })

  return [...filtered].sort(COMPARATORS[filters.sort])
}

/** Cantidad de piezas activas por categoría, para los contadores del filtro. */
export function countActiveProductsByCategory(catalog: Catalog): ReadonlyMap<CategoryId, number> {
  const counts = new Map<CategoryId, number>()

  for (const product of catalog.products) {
    if (!product.active) {
      continue
    }

    counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1)
  }

  return counts
}

/** Cantidad total de piezas activas en el catálogo. */
export function countActiveProducts(catalog: Catalog): number {
  return catalog.products.filter((product) => product.active).length
}
