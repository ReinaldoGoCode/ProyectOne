import type { Catalog, OrderItem } from './types'

/** Checks and deducts inventory as one in-memory operation after payment approval. */
export function deductStockForOrder(catalog: Catalog, items: readonly OrderItem[]): Catalog | null {
  const required = new Map<string, number>()
  for (const item of items) {
    const amount = (required.get(item.variantId) ?? 0) + item.quantity
    if (!Number.isSafeInteger(amount)) return null
    required.set(item.variantId, amount)
  }

  const products = new Map(catalog.products.map((product) => [product.id, product]))
  const variants = new Map(catalog.variants.map((variant) => [variant.id, variant]))
  for (const [variantId, quantity] of required) {
    const variant = variants.get(variantId)
    const product = variant ? products.get(variant.productId) : undefined
    if (!variant || !product?.active || variant.stock < quantity) return null
  }

  return {
    ...catalog,
    variants: catalog.variants.map((variant) => {
      const quantity = required.get(variant.id) ?? 0
      return quantity === 0 ? variant : { ...variant, stock: variant.stock - quantity }
    }),
  }
}
