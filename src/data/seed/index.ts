import { seedCategories } from './categories'
import { seedProducts, seedVariants } from './products'

import type { Catalog } from '@/domain/types'

/**
 * Catálogo ficticio completo. Es la única fuente de datos de la v1 y el punto
 * que reemplazará el repositorio cuando llegue Supabase.
 */
export const seedCatalog: Catalog = {
  categories: seedCategories,
  products: seedProducts,
  variants: seedVariants,
}

export { seedCategories, seedProducts, seedVariants }
