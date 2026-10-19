import { describe, expect, it } from 'vitest'

import {
  canAddQuantity,
  findVariant,
  getStockForSelection,
  getTotalStock,
  isCombinationAvailable,
  listAvailableColors,
  listAvailableSizes,
  listColors,
  listSizes,
} from '../product'
import type { Variant } from '../types'

const PRODUCT_ID = 'camisa-de-prueba'

const VARIANTS: readonly Variant[] = [
  {
    id: 'v-s-negro',
    productId: PRODUCT_ID,
    size: 'S',
    color: 'Negro',
    sku: 'NM-T-NEG-S',
    stock: 2,
  },
  {
    id: 'v-m-negro',
    productId: PRODUCT_ID,
    size: 'M',
    color: 'Negro',
    sku: 'NM-T-NEG-M',
    stock: 0,
  },
  {
    id: 'v-s-blanco',
    productId: PRODUCT_ID,
    size: 'S',
    color: 'Blanco',
    sku: 'NM-T-BLA-S',
    stock: 4,
  },
  {
    id: 'v-u-blanco',
    productId: PRODUCT_ID,
    size: 'Único',
    color: 'Blanco',
    sku: 'NM-T-BLA-UNICO',
    stock: 1,
  },
  {
    id: 'v-otro',
    productId: 'otro-producto',
    size: 'L',
    color: 'Verde',
    sku: 'NM-O-VER-L',
    stock: 9,
  },
]

describe('findVariant', () => {
  it('encuentra la combinación exacta de talla y color', () => {
    expect(findVariant(VARIANTS, PRODUCT_ID, 'S', 'Negro')?.id).toBe('v-s-negro')
  })

  it('devuelve undefined si la combinación no existe', () => {
    expect(findVariant(VARIANTS, PRODUCT_ID, 'XL', 'Negro')).toBeUndefined()
  })

  it('no mezcla variantes de otros productos', () => {
    expect(findVariant(VARIANTS, PRODUCT_ID, 'L', 'Verde')).toBeUndefined()
  })
})

describe('stock por combinación', () => {
  it('devuelve el stock de una variante existente', () => {
    expect(getStockForSelection(VARIANTS, PRODUCT_ID, 'S', 'Negro')).toBe(2)
  })

  it('devuelve 0 cuando la variante existe pero está agotada', () => {
    expect(getStockForSelection(VARIANTS, PRODUCT_ID, 'M', 'Negro')).toBe(0)
  })

  it('devuelve 0 cuando la combinación no existe', () => {
    expect(getStockForSelection(VARIANTS, PRODUCT_ID, 'XL', 'Azul')).toBe(0)
  })

  it('considera disponible solo lo que tiene stock', () => {
    expect(isCombinationAvailable(VARIANTS, PRODUCT_ID, 'S', 'Negro')).toBe(true)
    expect(isCombinationAvailable(VARIANTS, PRODUCT_ID, 'M', 'Negro')).toBe(false)
    expect(isCombinationAvailable(VARIANTS, PRODUCT_ID, 'XL', 'Negro')).toBe(false)
  })
})

describe('canAddQuantity', () => {
  it('permite agregar hasta el stock disponible', () => {
    expect(canAddQuantity(VARIANTS, PRODUCT_ID, 'S', 'Negro', 2)).toBe(true)
  })

  it('rechaza cantidades mayores al stock', () => {
    expect(canAddQuantity(VARIANTS, PRODUCT_ID, 'S', 'Negro', 3)).toBe(false)
  })

  it('rechaza cantidades no positivas o decimales', () => {
    expect(canAddQuantity(VARIANTS, PRODUCT_ID, 'S', 'Negro', 0)).toBe(false)
    expect(canAddQuantity(VARIANTS, PRODUCT_ID, 'S', 'Negro', -1)).toBe(false)
    expect(canAddQuantity(VARIANTS, PRODUCT_ID, 'S', 'Negro', 1.5)).toBe(false)
  })

  it('rechaza combinaciones inexistentes', () => {
    expect(canAddQuantity(VARIANTS, PRODUCT_ID, 'XXL', 'Negro', 1)).toBe(false)
  })
})

describe('listados para la interfaz', () => {
  it('lista todas las tallas en orden canónico, incluidas las agotadas', () => {
    expect(listSizes(VARIANTS, PRODUCT_ID)).toEqual(['S', 'M', 'Único'])
  })

  it('lista solo las tallas con stock', () => {
    expect(listAvailableSizes(VARIANTS, PRODUCT_ID)).toEqual(['S', 'Único'])
  })

  it('lista todos los colores ordenados alfabéticamente', () => {
    expect(listColors(VARIANTS, PRODUCT_ID)).toEqual(['Blanco', 'Negro'])
  })

  it('filtra colores por talla', () => {
    expect(listColors(VARIANTS, PRODUCT_ID, 'M')).toEqual(['Negro'])
    expect(listColors(VARIANTS, PRODUCT_ID, 'Único')).toEqual(['Blanco'])
  })

  it('lista solo los colores con stock', () => {
    expect(listAvailableColors(VARIANTS, PRODUCT_ID)).toEqual(['Blanco', 'Negro'])
    expect(listAvailableColors(VARIANTS, PRODUCT_ID, 'M')).toEqual([])
  })

  it('suma el stock de todas las variantes del producto', () => {
    expect(getTotalStock(VARIANTS, PRODUCT_ID)).toBe(7)
  })
})
