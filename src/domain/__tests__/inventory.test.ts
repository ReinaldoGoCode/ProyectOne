import { describe, expect, it } from 'vitest'

import { deductStockForOrder } from '../inventory'
import type { Catalog, OrderItem } from '../types'

const CATALOG: Catalog = {
  categories: [{ id: 'tops', slug: 'tops', name: 'Tops', description: '' }],
  products: [
    {
      id: 'shirt',
      slug: 'shirt',
      name: 'Camisa',
      categoryId: 'tops',
      description: '',
      composition: '',
      care: '',
      priceCents: 1200,
      imageUrl: '/shirt.svg',
      imageAlt: '',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  variants: [
    {
      id: 'shirt-m',
      productId: 'shirt',
      size: 'M',
      color: 'Arena',
      sku: 'SHIRT-M',
      stock: 3,
    },
  ],
}

const ITEM: OrderItem = {
  productId: 'shirt',
  variantId: 'shirt-m',
  productName: 'Camisa',
  size: 'M',
  color: 'Arena',
  unitPriceCents: 1200,
  quantity: 2,
}

describe('descuento de inventario tras aprobar pago', () => {
  it('revalida y descuenta las cantidades sin mutar el catálogo anterior', () => {
    const updated = deductStockForOrder(CATALOG, [ITEM])
    expect(updated?.variants[0]?.stock).toBe(1)
    expect(CATALOG.variants[0]?.stock).toBe(3)
  })

  it('bloquea la compra si una variante no tiene stock suficiente o está inactiva', () => {
    expect(deductStockForOrder(CATALOG, [{ ...ITEM, quantity: 4 }])).toBeNull()
    expect(
      deductStockForOrder(
        {
          ...CATALOG,
          products: CATALOG.products.map((product) => ({ ...product, active: false })),
        },
        [ITEM],
      ),
    ).toBeNull()
  })

  it('suma líneas repetidas de la misma variante antes de descontar', () => {
    expect(deductStockForOrder(CATALOG, [ITEM, ITEM])).toBeNull()
  })
})
