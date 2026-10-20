import { createContext, useContext } from 'react'

import type { Catalog, CategoryId, Product, ProductId, Size } from '@/domain/types'

export interface ProductInput {
  readonly name: string
  readonly categoryId: CategoryId
  readonly description: string
  readonly composition: string
  readonly care: string
  readonly priceCents: number
  readonly active: boolean
}

export interface VariantInput {
  readonly id?: string
  readonly productId: ProductId
  readonly size: Size
  readonly color: string
  readonly sku: string
  readonly stock: number
}

export interface CatalogContextValue {
  readonly catalog: Catalog
  readonly createProduct: (input: ProductInput) => Product
  readonly updateProduct: (id: ProductId, input: ProductInput) => void
  readonly setProductActive: (id: ProductId, active: boolean) => void
  readonly saveVariant: (input: VariantInput) => void
  readonly deleteVariant: (id: string) => void
  readonly resetCatalog: () => void
}

export const CatalogContext = createContext<CatalogContextValue | null>(null)

export function useCatalog(): CatalogContextValue {
  const context = useContext(CatalogContext)

  if (context === null) {
    throw new Error('useCatalog debe usarse dentro de CatalogProvider')
  }

  return context
}
