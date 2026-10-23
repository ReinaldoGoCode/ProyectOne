import { describe, expect, it } from 'vitest'

import { seedCatalog } from '@/data/seed'
import {
  createInventoryCsvTemplate,
  exportInventoryCsv,
  INVENTORY_CSV_HEADERS,
  planInventoryCsv,
} from './inventoryCsv'

function csvRow(values: readonly string[]): string {
  return values.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')
}

describe('importación y exportación de inventario CSV', () => {
  it('ofrece plantilla compatible y exporta las variantes por SKU', () => {
    const template = createInventoryCsvTemplate()
    const exported = exportInventoryCsv(seedCatalog)
    const headers = csvRow(INVENTORY_CSV_HEADERS)

    expect(template.replace(/^\uFEFF/, '').trim()).toBe(headers)
    expect(exported).toContain('"sku"')
    expect(exported.split(/\r?\n/).length).toBe(seedCatalog.variants.length + 2)
    const roundTrip = planInventoryCsv(seedCatalog, exported)
    expect(roundTrip.errors).toEqual([])
    expect(roundTrip.catalog).toEqual(seedCatalog)
    expect(roundTrip.movements).toEqual([])
  })

  it('recibe unidades por SKU y conserva talla y color al generar el historial', () => {
    const variant = seedCatalog.variants[0]
    if (!variant) throw new Error('Falta una variante inicial.')
    const product = seedCatalog.products.find((item) => item.id === variant.productId)
    const category = seedCatalog.categories.find((item) => item.id === product?.categoryId)
    if (!product || !category) throw new Error('Falta el producto de la variante.')
    const row = csvRow([
      product.slug,
      product.slug,
      category.slug,
      product.description,
      '',
      '',
      variant.sku,
      variant.size,
      variant.color,
      '',
      '50',
    ])
    const plan = planInventoryCsv(seedCatalog, `${csvRow(INVENTORY_CSV_HEADERS)}\n${row}`)

    expect(plan.errors).toEqual([])
    expect(plan.catalog?.variants.find((item) => item.id === variant.id)?.stock).toBe(
      variant.stock + 50,
    )
    expect(plan.movements).toMatchObject([
      {
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        delta: 50,
        reason: 'import',
      },
    ])
  })

  it('rechaza un SKU repetido y no entrega un catálogo parcial', () => {
    const variant = seedCatalog.variants[0]
    if (!variant) throw new Error('Falta una variante inicial.')
    const product = seedCatalog.products.find((item) => item.id === variant.productId)
    const category = seedCatalog.categories.find((item) => item.id === product?.categoryId)
    if (!product || !category) throw new Error('Falta el producto de la variante.')
    const cells = [
      product.slug,
      product.name,
      category.slug,
      product.description,
      '',
      '',
      variant.sku,
      variant.size,
      variant.color,
      '',
      '1',
    ]
    const row = csvRow(cells)
    const plan = planInventoryCsv(seedCatalog, `${csvRow(INVENTORY_CSV_HEADERS)}\n${row}\n${row}`)

    expect(plan.catalog).toBeNull()
    expect(plan.errors.some((issue) => issue.message.includes('SKU duplicado'))).toBe(true)
    expect(plan.movements).toEqual([])
  })

  it('crea producto y variantes respetando categoría, SKU y stock inicial', () => {
    const category = seedCatalog.categories[0]
    if (!category) throw new Error('Falta una categoría de prueba.')
    const row = csvRow([
      'camisa-prueba-csv',
      'Camisa Prueba CSV',
      category.slug,
      'Descripción con, coma',
      '29.95',
      'true',
      'NM-CSV-001',
      'M',
      'Azul',
      '25',
      '',
    ])
    const plan = planInventoryCsv(seedCatalog, `${csvRow(INVENTORY_CSV_HEADERS)}\r\n${row}`)

    expect(plan.errors).toEqual([])
    expect(plan.createdProducts).toBe(1)
    expect(plan.createdVariants).toBe(1)
    expect(plan.catalog?.products.find((item) => item.slug === 'camisa-prueba-csv')).toMatchObject({
      name: 'Camisa Prueba CSV',
      priceCents: 2995,
    })
    expect(plan.catalog?.variants.find((item) => item.sku === 'NM-CSV-001')).toMatchObject({
      size: 'M',
      color: 'Azul',
      stock: 25,
    })
  })
})
