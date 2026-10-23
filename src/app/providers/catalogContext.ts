import { createContext, useContext } from 'react'

import type {
  Catalog,
  CategoryId,
  InventoryMovement,
  Order,
  Product,
  ProductId,
  Size,
} from '@/domain/types'

export interface InventoryImportSummary {
  readonly createdProducts: number
  readonly createdVariants: number
  readonly changedVariants: number
  readonly movements: number
}

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
  readonly catalogMode: 'demo' | 'loading' | 'connected' | 'error'
  readonly refreshCatalog: () => Promise<void>
  readonly inventoryMovements: readonly InventoryMovement[]
  readonly createProduct: (input: ProductInput) => Product
  readonly updateProduct: (id: ProductId, input: ProductInput) => void
  readonly setProductActive: (id: ProductId, active: boolean) => void
  readonly saveVariant: (input: VariantInput) => void
  readonly deleteVariant: (id: string) => void
  readonly applyInventoryCsv: (csvText: string) => InventoryImportSummary
  readonly resetCatalog: () => void
  /** Demo-only stock check and deduction performed after manual payment approval. */
  readonly consumeStockForOrder: (order: Order) => boolean
}

export const CatalogContext = createContext<CatalogContextValue | null>(null)

export function useCatalog(): CatalogContextValue {
  const context = useContext(CatalogContext)

  if (context === null) {
    throw new Error('useCatalog debe usarse dentro de CatalogProvider')
  }

  return context
}
