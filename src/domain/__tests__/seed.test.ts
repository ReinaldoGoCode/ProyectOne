import { describe, expect, it } from 'vitest'

import { seedCatalog } from '@/data/seed'
import { isValidCents } from '@/domain/money'

describe('seed del catálogo', () => {
  it('incluye seis categorías con identificadores y slugs únicos', () => {
    expect(seedCatalog.categories).toHaveLength(6)
    expect(new Set(seedCatalog.categories.map((category) => category.id)).size).toBe(6)
    expect(new Set(seedCatalog.categories.map((category) => category.slug)).size).toBe(6)
  })

  it('incluye veintiún productos con identificadores y slugs únicos', () => {
    expect(seedCatalog.products).toHaveLength(21)
    expect(new Set(seedCatalog.products.map((product) => product.id)).size).toBe(21)
    expect(new Set(seedCatalog.products.map((product) => product.slug)).size).toBe(21)
  })

  it('solo referencia categorías que existen', () => {
    const categoryIds = new Set(seedCatalog.categories.map((category) => category.id))

    for (const product of seedCatalog.products) {
      expect(categoryIds.has(product.categoryId)).toBe(true)
    }
  })

  it('guarda precios válidos en centavos', () => {
    for (const product of seedCatalog.products) {
      expect(isValidCents(product.priceCents)).toBe(true)
      expect(product.priceCents).toBeGreaterThan(0)
    }
  })

  it('da al menos una variante a cada producto', () => {
    const productIdsWithVariants = new Set(seedCatalog.variants.map((variant) => variant.productId))

    for (const product of seedCatalog.products) {
      expect(productIdsWithVariants.has(product.id)).toBe(true)
    }
  })

  it('no repite identificadores ni SKU de variantes', () => {
    const ids = new Set(seedCatalog.variants.map((variant) => variant.id))
    const skus = new Set(seedCatalog.variants.map((variant) => variant.sku))

    expect(ids.size).toBe(seedCatalog.variants.length)
    expect(skus.size).toBe(seedCatalog.variants.length)
  })

  it('usa stock entero y no negativo', () => {
    for (const variant of seedCatalog.variants) {
      expect(Number.isInteger(variant.stock)).toBe(true)
      expect(variant.stock).toBeGreaterThanOrEqual(0)
    }
  })

  it('incluye combinaciones agotadas para probar la interfaz', () => {
    expect(seedCatalog.variants.some((variant) => variant.stock === 0)).toBe(true)

    const stockByProduct = new Map<string, number>()

    for (const variant of seedCatalog.variants) {
      stockByProduct.set(
        variant.productId,
        (stockByProduct.get(variant.productId) ?? 0) + variant.stock,
      )
    }

    expect([...stockByProduct.values()].some((total) => total === 0)).toBe(true)
  })

  it('marca al menos un producto inactivo', () => {
    expect(seedCatalog.products.some((product) => !product.active)).toBe(true)
  })

  it('apunta a una imagen local y describe su contenido', () => {
    for (const product of seedCatalog.products) {
      expect(product.imageUrl.startsWith('/images/products/')).toBe(true)
      expect(product.imageAlt.length).toBeGreaterThan(0)
    }
  })
})
