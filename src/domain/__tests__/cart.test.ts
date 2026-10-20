import { describe, expect, it } from 'vitest'

import {
  addCartLine,
  clearCartLines,
  removeCartLine,
  revalidateCart,
  sanitizeCartLines,
  setCartQuantity,
  summarizeCart,
} from '../cart'
import type { Catalog, Product, Variant } from '../types'

const PRODUCT_A: Product = {
  id: 'producto-a',
  slug: 'producto-a',
  name: 'Camisa A',
  categoryId: 'camisas',
  description: 'Camisa de prueba',
  composition: 'Algodón',
  care: 'Lavar a mano',
  priceCents: 2800,
  imageUrl: '/x.svg',
  imageAlt: 'Camisa A',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const PRODUCT_B: Product = {
  ...PRODUCT_A,
  id: 'producto-b',
  slug: 'producto-b',
  name: 'Pantalón B',
  priceCents: 3400,
}

const PRODUCT_C: Product = {
  ...PRODUCT_A,
  id: 'producto-c',
  slug: 'producto-c',
  name: 'Prenda inactiva',
  priceCents: 1000,
  active: false,
}

const A_M_NEGRO: Variant = {
  id: 'a-m-negro',
  productId: 'producto-a',
  size: 'M',
  color: 'Negro',
  sku: 'A-M-NEGRO',
  stock: 3,
}

const A_M_BLANCO: Variant = {
  id: 'a-m-blanco',
  productId: 'producto-a',
  size: 'M',
  color: 'Blanco',
  sku: 'A-M-BLANCO',
  stock: 0,
}

const B_S_ARENA: Variant = {
  id: 'b-s-arena',
  productId: 'producto-b',
  size: 'S',
  color: 'Arena',
  sku: 'B-S-ARENA',
  stock: 5,
}

const C_UNICO: Variant = {
  id: 'c-unico',
  productId: 'producto-c',
  size: 'Único',
  color: 'Negro',
  sku: 'C-UNICO',
  stock: 2,
}

const CATALOG: Catalog = {
  categories: [],
  products: [PRODUCT_A, PRODUCT_B, PRODUCT_C],
  variants: [A_M_NEGRO, A_M_BLANCO, B_S_ARENA, C_UNICO],
}

describe('addCartLine', () => {
  it('agrega una variante nueva con su cantidad', () => {
    expect(addCartLine([], 'a-m-negro', 2, 3)).toEqual([{ variantId: 'a-m-negro', quantity: 2 }])
  })

  it('incrementa una línea existente', () => {
    const lines = addCartLine([{ variantId: 'a-m-negro', quantity: 1 }], 'a-m-negro', 2, 3)

    expect(lines).toEqual([{ variantId: 'a-m-negro', quantity: 3 }])
  })

  it('recorta la cantidad al stock disponible', () => {
    const lines = addCartLine([{ variantId: 'a-m-negro', quantity: 2 }], 'a-m-negro', 5, 3)

    expect(lines).toEqual([{ variantId: 'a-m-negro', quantity: 3 }])
  })

  it('ignora cantidades inválidas o variantes sin stock', () => {
    expect(addCartLine([], 'a-m-negro', 0, 3)).toEqual([])
    expect(addCartLine([], 'a-m-negro', 1.5, 3)).toEqual([])
    expect(addCartLine([], 'a-m-negro', 1, 0)).toEqual([])
  })
})

describe('setCartQuantity y eliminación', () => {
  it('cambia la cantidad respetando el stock', () => {
    const lines = [{ variantId: 'a-m-negro', quantity: 1 }]

    expect(setCartQuantity(lines, 'a-m-negro', 2, 3)).toEqual([
      { variantId: 'a-m-negro', quantity: 2 },
    ])
    expect(setCartQuantity(lines, 'a-m-negro', 99, 3)).toEqual([
      { variantId: 'a-m-negro', quantity: 3 },
    ])
  })

  it('elimina la línea cuando la cantidad es cero o menos', () => {
    const lines = [{ variantId: 'a-m-negro', quantity: 2 }]

    expect(setCartQuantity(lines, 'a-m-negro', 0, 3)).toEqual([])
    expect(setCartQuantity(lines, 'a-m-negro', -1, 3)).toEqual([])
  })

  it('elimina una línea concreta y vacía el carrito', () => {
    const lines = [
      { variantId: 'a-m-negro', quantity: 1 },
      { variantId: 'b-s-arena', quantity: 1 },
    ]

    expect(removeCartLine(lines, 'a-m-negro')).toEqual([{ variantId: 'b-s-arena', quantity: 1 }])
    expect(clearCartLines()).toEqual([])
  })
})

describe('summarizeCart', () => {
  it('calcula subtotal y cantidad de artículos con precios del catálogo', () => {
    const summary = summarizeCart(
      [
        { variantId: 'a-m-negro', quantity: 2 },
        { variantId: 'b-s-arena', quantity: 1 },
      ],
      CATALOG,
    )

    expect(summary.subtotalCents).toBe(9000)
    expect(summary.itemCount).toBe(3)
    expect(summary.details).toHaveLength(2)
    expect(summary.issues).toEqual([])
    expect(summary.canCheckout).toBe(true)
  })

  it('no permite checkout con el carrito vacío', () => {
    const summary = summarizeCart([], CATALOG)

    expect(summary.canCheckout).toBe(false)
    expect(summary.subtotalCents).toBe(0)
  })
})

describe('revalidateCart', () => {
  it('quita variantes inexistentes, productos inactivos y agotados', () => {
    const result = revalidateCart(
      [
        { variantId: 'no-existe', quantity: 1 },
        { variantId: 'c-unico', quantity: 1 },
        { variantId: 'a-m-blanco', quantity: 1 },
      ],
      CATALOG,
    )

    expect(result.lines).toEqual([])
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'missing_variant',
      'inactive_product',
      'out_of_stock',
    ])
  })

  it('recorta cantidades por encima del stock y lo informa', () => {
    const result = revalidateCart([{ variantId: 'a-m-negro', quantity: 9 }], CATALOG)

    expect(result.lines).toEqual([{ variantId: 'a-m-negro', quantity: 3 }])
    expect(result.issues[0]?.code).toBe('quantity_reduced')
  })
})

describe('sanitizeCartLines', () => {
  it('descarta datos dañados y combina duplicados', () => {
    const raw: unknown = [
      { variantId: 'a-m-negro', quantity: 2 },
      { variantId: 'a-m-negro', quantity: 2 },
      { variantId: 'b-s-arena', quantity: 99 },
      { variantId: 'c-unico', quantity: 1 },
      { variantId: 'no-existe', quantity: 1 },
      { variantId: 'a-m-negro', quantity: 'dos' },
      null,
      'basura',
    ]

    expect(sanitizeCartLines(raw, CATALOG)).toEqual([
      { variantId: 'a-m-negro', quantity: 3 },
      { variantId: 'b-s-arena', quantity: 5 },
    ])
  })

  it('devuelve un carrito vacío si el valor guardado no es una lista', () => {
    expect(sanitizeCartLines({ lines: [] }, CATALOG)).toEqual([])
    expect(sanitizeCartLines(null, CATALOG)).toEqual([])
  })
})
