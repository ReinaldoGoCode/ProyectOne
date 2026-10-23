import { describe, expect, it } from 'vitest'

import { seedCatalog } from '@/data/seed'

import {
  clearDirectCheckoutIntent,
  createDirectCheckoutIntent,
  getOrCreateDirectCheckoutCredentials,
  readDirectCheckoutIntent,
  resolveDirectCheckoutSelection,
} from './directCheckout'

class MemorySessionStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const product = seedCatalog.products.find((item) => item.slug === 'camisa-lino-margarita')
const availableVariant = seedCatalog.variants.find(
  (variant) =>
    variant.productId === product?.id && variant.color === 'Negro' && variant.size === 'S',
)

if (!product || !availableVariant) throw new Error('Falta la variante ficticia de prueba.')

describe('compra directa', () => {
  it('guarda la selección en la sesión, la recupera y conserva credenciales al reintentar', () => {
    const storage = new MemorySessionStorage()
    const token = createDirectCheckoutIntent(availableVariant.id, 2, storage)
    expect(token).toMatch(/^[a-f\d-]{36}$/i)
    if (!token) throw new Error('No se creó la intención de prueba.')

    expect(readDirectCheckoutIntent(token, storage)).toMatchObject({
      variantId: availableVariant.id,
      quantity: 2,
    })

    const credentials = {
      idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
      trackingToken: 'a'.repeat(64),
    }
    const factory = () => credentials
    expect(getOrCreateDirectCheckoutCredentials(token, factory, storage)).toEqual(credentials)
    expect(getOrCreateDirectCheckoutCredentials(token, factory, storage)).toEqual(credentials)
    expect(readDirectCheckoutIntent(token, storage)).toMatchObject({ quantity: 2 })

    clearDirectCheckoutIntent(token, storage)
    expect(readDirectCheckoutIntent(token, storage)).toBeNull()
  })

  it('rechaza cantidades que no sean enteros positivos al crear la compra', () => {
    const storage = new MemorySessionStorage()
    expect(createDirectCheckoutIntent(availableVariant.id, 0, storage)).toBeNull()
    expect(createDirectCheckoutIntent(availableVariant.id, 1.5, storage)).toBeNull()
    expect(createDirectCheckoutIntent(' ', 1, storage)).toBeNull()
  })

  it('valida variante, estado del producto, cantidad y existencias contra el catálogo', () => {
    expect(resolveDirectCheckoutSelection(seedCatalog, availableVariant.id, 2)).toMatchObject({
      status: 'ready',
      line: { variantId: availableVariant.id, quantity: 2 },
    })
    expect(resolveDirectCheckoutSelection(seedCatalog, availableVariant.id, 4)).toEqual({
      status: 'unavailable',
      message: 'Elige una cantidad entre 1 y 2 unidades disponibles.',
      productSlug: product.slug,
    })
    expect(resolveDirectCheckoutSelection(seedCatalog, availableVariant.id, 1.5).status).toBe(
      'unavailable',
    )
    expect(resolveDirectCheckoutSelection(seedCatalog, 'missing-variant', 1).status).toBe(
      'unavailable',
    )

    const inactiveCatalog = {
      ...seedCatalog,
      products: seedCatalog.products.map((item) =>
        item.id === product.id ? { ...item, active: false } : item,
      ),
    }
    expect(resolveDirectCheckoutSelection(inactiveCatalog, availableVariant.id, 1).status).toBe(
      'unavailable',
    )

    const emptyStockCatalog = {
      ...seedCatalog,
      variants: seedCatalog.variants.map((item) =>
        item.id === availableVariant.id ? { ...item, stock: 0 } : item,
      ),
    }
    expect(resolveDirectCheckoutSelection(emptyStockCatalog, availableVariant.id, 1).status).toBe(
      'unavailable',
    )
  })

  it('muestra una intención guardada como no recuperable si está corrupta o incompleta', () => {
    const storage = new MemorySessionStorage()
    storage.setItem(
      'norte-moda:direct-checkout:123e4567-e89b-42d3-a456-426614174000',
      '{"version":1,"variantId":"sku","quantity":0,"createdAt":0}',
    )
    expect(readDirectCheckoutIntent('123e4567-e89b-42d3-a456-426614174000', storage)).toBeNull()
  })
})
