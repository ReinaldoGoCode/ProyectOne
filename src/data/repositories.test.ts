import { describe, expect, it } from 'vitest'

import { createCartRepository } from './repositories/cartRepository'
import { createCatalogRepository } from './repositories/catalogRepository'
import { createOrderRepository } from './repositories/orderRepository'
import type { KeyValueStorage } from './storage'
import { STORAGE_KEYS } from './storage'
import { seedCatalog } from './seed'
import { createOrder } from '@/domain/order'

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>()
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

function demoOrder() {
  const product = seedCatalog.products[0]
  const variant = seedCatalog.variants.find(
    (item) => item.productId === product?.id && item.stock > 0,
  )
  if (!product || !variant)
    throw new Error('El catálogo de prueba necesita una variante disponible.')
  return createOrder({
    code: 'NM-0001',
    customer: { firstName: 'Ana', lastName: 'Pérez', phone: '+58 412 000 0000', email: null },
    deliveryMethod: 'retiro',
    shippingAddress: null,
    shippingAgency: null,
    paymentMethod: 'efectivo',
    paymentReference: null,
    customerNote: null,
    items: [
      {
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        size: variant.size,
        color: variant.color,
        unitPriceCents: product.priceCents,
        quantity: 1,
      },
    ],
    shippingCents: 0,
  })
}

describe('repositorios locales', () => {
  it('persiste y recupera líneas de carrito tipadas', () => {
    const storage = new MemoryStorage()
    const repository = createCartRepository(storage)
    const variant = seedCatalog.variants.find((item) => item.stock > 0)
    if (!variant) throw new Error('El catálogo necesita stock de prueba.')

    expect(repository.save([{ variantId: variant.id, quantity: 2 }], seedCatalog)).toBe(true)
    expect(repository.load(seedCatalog)).toEqual([{ variantId: variant.id, quantity: 2 }])
  })

  it('limita cantidades al stock y descarta entradas de carrito no válidas', () => {
    const storage = new MemoryStorage()
    const variant = seedCatalog.variants.find((item) => item.stock > 0)
    if (!variant) throw new Error('El catálogo necesita stock de prueba.')
    storage.setItem(
      STORAGE_KEYS.cart,
      JSON.stringify([
        { variantId: variant.id, quantity: 99 },
        { variantId: 'no-existe', quantity: 1 },
        { variantId: variant.id, quantity: 'muchas' },
      ]),
    )

    const lines = createCartRepository(storage).load(seedCatalog)
    expect(lines).toEqual([{ variantId: variant.id, quantity: variant.stock }])
  })

  it('restaura el seed si el catálogo guardado no es válido', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.catalog, '{"products":"dañado"}')
    const catalog = createCatalogRepository(storage).load()
    expect(catalog).toEqual(seedCatalog)
    expect(storage.getItem(STORAGE_KEYS.catalog)).toBeNull()
  })

  it('persiste pedidos y encuentra códigos sin distinguir mayúsculas', () => {
    const storage = new MemoryStorage()
    const repository = createOrderRepository(storage)
    const order = demoOrder()
    expect(repository.save(order)).toBe(true)
    expect(repository.findByCode(' nm-0001 ')?.id).toBe(order.id)
  })

  it('descarta pedidos dañados en lugar de cargar totales inconsistentes', () => {
    const storage = new MemoryStorage()
    const order = { ...demoOrder(), totalCents: 1 }
    storage.setItem(STORAGE_KEYS.orders, JSON.stringify([order]))
    expect(createOrderRepository(storage).list()).toEqual([])
    expect(storage.getItem(STORAGE_KEYS.orders)).toBeNull()
  })
})
