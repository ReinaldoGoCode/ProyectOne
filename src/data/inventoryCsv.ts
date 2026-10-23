import type { Catalog, InventoryMovement, Product, Size, Variant } from '@/domain/types'
import { slugify } from '@/lib/text'

export const INVENTORY_CSV_HEADERS = [
  'product_slug',
  'product_name',
  'category',
  'description',
  'price_usd',
  'active',
  'sku',
  'size',
  'color',
  'stock_on_hand',
  'stock_delta',
] as const

const VALID_SIZES: readonly Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único']
const MAX_IMPORT_ROWS = 5000
const PLACEHOLDER_IMAGE = '/images/products/placeholder.svg'

export interface CsvIssue {
  readonly row: number
  readonly message: string
}

export interface InventoryCsvPlan {
  readonly errors: readonly CsvIssue[]
  readonly catalog: Catalog | null
  readonly movements: readonly InventoryMovement[]
  readonly createdProducts: number
  readonly createdVariants: number
  readonly changedVariants: number
}

function parseCsv(text: string): { rows: string[][]; errors: string[] } {
  const rows: string[][] = []
  const errors: string[] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let afterQuote = false
  let line = 1
  let rowHasContent = false
  const source = text.replace(/^\uFEFF/, '')

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? ''
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
        afterQuote = true
      } else {
        cell += character
        if (character === '\n') line += 1
      }
      continue
    }

    if (
      afterQuote &&
      character !== ',' &&
      character !== '\r' &&
      character !== '\n' &&
      character.trim() !== ''
    ) {
      errors.push(`Línea ${String(line)}: hay texto después de una comilla de cierre.`)
      afterQuote = false
    }
    if (character === '"' && cell === '' && !afterQuote) {
      quoted = true
      rowHasContent = true
    } else if (character === ',') {
      row.push(cell)
      cell = ''
      afterQuote = false
      rowHasContent = true
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(cell)
      if (rowHasContent || row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      cell = ''
      afterQuote = false
      rowHasContent = false
      line += 1
    } else {
      cell += character
      if (character.trim() !== '') rowHasContent = true
    }
  }
  if (quoted) errors.push(`Línea ${String(line)}: falta cerrar una comilla.`)
  if (rowHasContent || row.length > 0 || cell !== '') {
    row.push(cell)
    rows.push(row)
  }
  return { rows, errors }
}

function textCell(value: string | undefined): string {
  const trimmed = (value ?? '').trim()
  return /^'[=+@-]/.test(trimmed) ? trimmed.slice(1) : trimmed
}

function parseInteger(
  value: string,
  row: number,
  field: string,
  errors: CsvIssue[],
): number | null {
  if (!/^-?\d+$/.test(value)) {
    errors.push({ row, message: `${field} debe ser un número entero.` })
    return null
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    errors.push({ row, message: `${field} está fuera del rango permitido.` })
    return null
  }
  return parsed
}

function parsePrice(value: string, row: number, errors: CsvIssue[]): number | null {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) {
    errors.push({ row, message: 'price_usd debe ser un importe positivo con hasta 2 decimales.' })
    return null
  }
  const cents = Math.round(Number(value.replace(',', '.')) * 100)
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    errors.push({ row, message: 'price_usd debe ser mayor que cero.' })
    return null
  }
  return cents
}

function parseActive(value: string, row: number, errors: CsvIssue[]): boolean | null {
  const normalized = value.toLowerCase()
  if (['true', '1', 'sí', 'si', 'yes'].includes(normalized)) return true
  if (['false', '0', 'no'].includes(normalized)) return false
  errors.push({ row, message: 'active debe ser true/false, sí/no o 1/0.' })
  return null
}

function escapeCell(value: string): string {
  const safe = /^[=+@-]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

function csvRow(values: readonly (string | number)[]): string {
  return values.map((value) => escapeCell(String(value))).join(',')
}

export function createInventoryCsvTemplate(): string {
  return `\uFEFF${csvRow(INVENTORY_CSV_HEADERS)}\r\n`
}

export function exportInventoryCsv(catalog: Catalog): string {
  const categories = new Map(catalog.categories.map((category) => [category.id, category]))
  const variantsByProduct = new Map<string, Variant[]>()
  for (const variant of catalog.variants) {
    const list = variantsByProduct.get(variant.productId) ?? []
    list.push(variant)
    variantsByProduct.set(variant.productId, list)
  }

  const lines = [csvRow(INVENTORY_CSV_HEADERS)]
  for (const product of catalog.products) {
    const category = categories.get(product.categoryId)
    const variants = variantsByProduct.get(product.id) ?? []
    const common = [
      product.slug,
      product.name,
      category?.slug ?? '',
      product.description,
      (product.priceCents / 100).toFixed(2),
      product.active ? 'true' : 'false',
    ] as const
    if (variants.length === 0) {
      lines.push(csvRow([...common, '', '', '', '', '']))
      continue
    }
    for (const variant of variants) {
      lines.push(csvRow([...common, variant.sku, variant.size, variant.color, variant.stock, '']))
    }
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function planInventoryCsv(catalog: Catalog, csvText: string): InventoryCsvPlan {
  const parsed = parseCsv(csvText)
  const errors: CsvIssue[] = parsed.errors.map((message) => ({ row: 1, message }))
  const [rawHeaders, ...rawRows] = parsed.rows
  if (!rawHeaders || rawRows.length === 0) {
    return {
      errors: [
        { row: 1, message: 'El CSV debe incluir encabezados y al menos una fila.' },
        ...errors,
      ],
      catalog: null,
      movements: [],
      createdProducts: 0,
      createdVariants: 0,
      changedVariants: 0,
    }
  }
  if (rawRows.length > MAX_IMPORT_ROWS) {
    errors.push({
      row: 1,
      message: `El archivo supera el máximo de ${String(MAX_IMPORT_ROWS)} filas.`,
    })
  }
  const headers = rawHeaders.map((header) => header.trim().toLowerCase())
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index)
  const firstDuplicate = duplicates[0]
  if (firstDuplicate) errors.push({ row: 1, message: `Encabezado duplicado: ${firstDuplicate}.` })
  for (const required of ['product_slug', 'sku', 'size', 'color']) {
    if (!headers.includes(required)) {
      errors.push({ row: 1, message: `Falta la columna obligatoria ${required}.` })
    }
  }
  if (errors.length > 0) {
    return {
      errors,
      catalog: null,
      movements: [],
      createdProducts: 0,
      createdVariants: 0,
      changedVariants: 0,
    }
  }

  const column = (name: string) => headers.indexOf(name)
  const read = (cells: readonly string[], name: string) => textCell(cells[column(name)])
  const rows: {
    line: number
    slug: string
    name: string
    category: string
    description: string
    priceCents: number | null
    active: boolean | null
    sku: string
    size: Size | ''
    color: string
    stockOnHand: number | null
    stockDelta: number | null
    hasOnHand: boolean
    hasDelta: boolean
  }[] = []

  rawRows.forEach((cells, index) => {
    const line = index + 2
    if (cells.length > headers.length && cells.slice(headers.length).some((cell) => cell.trim())) {
      errors.push({ row: line, message: 'La fila tiene más valores que encabezados.' })
    }
    const slug = read(cells, 'product_slug').toLowerCase()
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      errors.push({
        row: line,
        message: `product_slug no válido: ${slug || '(vacío)'}. Usa letras minúsculas, números y guiones.`,
      })
    }
    const sku = read(cells, 'sku').toUpperCase()
    const sizeValue = read(cells, 'size')
    const color = read(cells, 'color')
    const variantCells = [sku, sizeValue, color]
    const hasAnyVariantField = variantCells.some(Boolean)
    const hasAllVariantFields = variantCells.every(Boolean)
    if (hasAnyVariantField && !hasAllVariantFields) {
      errors.push({ row: line, message: 'Para una variante se requieren sku, size y color.' })
    }
    if (sizeValue && !VALID_SIZES.includes(sizeValue as Size)) {
      errors.push({ row: line, message: `Talla no válida: ${sizeValue}.` })
    }
    const onHandText = read(cells, 'stock_on_hand')
    const deltaText = read(cells, 'stock_delta')
    if (onHandText && deltaText) {
      errors.push({ row: line, message: 'Usa stock_on_hand o stock_delta, pero no ambos.' })
    }
    const stockOnHand = onHandText ? parseInteger(onHandText, line, 'stock_on_hand', errors) : null
    const stockDelta = deltaText ? parseInteger(deltaText, line, 'stock_delta', errors) : null
    if (stockOnHand !== null && stockOnHand < 0)
      errors.push({ row: line, message: 'stock_on_hand no puede ser negativo.' })
    const priceText = read(cells, 'price_usd')
    const priceCents = priceText ? parsePrice(priceText, line, errors) : null
    const activeText = read(cells, 'active')
    const active = activeText ? parseActive(activeText, line, errors) : null
    rows.push({
      line,
      slug,
      name: read(cells, 'product_name'),
      category: read(cells, 'category'),
      description: read(cells, 'description'),
      priceCents,
      active,
      sku,
      size: (sizeValue as Size | '') || '',
      color,
      stockOnHand,
      stockDelta,
      hasOnHand: Boolean(onHandText),
      hasDelta: Boolean(deltaText),
    })
  })

  const seenSkus = new Set<string>()
  const seenPairs = new Set<string>()
  const updatesBySlug = new Map<
    string,
    {
      line: number
      name?: string
      categoryId?: string
      description?: string
      priceCents?: number
      active?: boolean
    }
  >()
  const productsBySlug = new Map(catalog.products.map((product) => [product.slug, product]))
  const skuMap = new Map(catalog.variants.map((variant) => [variant.sku.toUpperCase(), variant]))
  const productsToCreate = new Map<string, Product>()
  const variantsToAdd: Variant[] = []
  const changedStocks = new Map<
    string,
    { next: number; delta: number; reason: 'import' | 'adjustment'; line: number }
  >()
  const createdProductsSlugs = new Set<string>()

  for (const row of rows) {
    const existingProduct = productsBySlug.get(row.slug) ?? productsToCreate.get(row.slug)
    let categoryId: string | undefined
    if (row.category) {
      const category = catalog.categories.find(
        (item) =>
          item.slug.toLowerCase() === row.category.toLowerCase() ||
          item.name.toLowerCase() === row.category.toLowerCase(),
      )
      if (!category)
        errors.push({ row: row.line, message: `Categoría desconocida: ${row.category}.` })
      else categoryId = category.id
    }

    if (!existingProduct) {
      if (!row.name || !categoryId || row.priceCents === null) {
        errors.push({
          row: row.line,
          message: 'Para crear un producto nuevo se necesitan product_name, category y price_usd.',
        })
      } else {
        const product: Product = {
          id: row.slug,
          slug: row.slug,
          name: row.name,
          categoryId,
          description: row.description,
          composition: '',
          care: '',
          priceCents: row.priceCents,
          imageUrl: PLACEHOLDER_IMAGE,
          imageAlt: `${row.name}: imagen de referencia de la prenda`,
          active: row.active ?? true,
          createdAt: new Date().toISOString(),
        }
        productsToCreate.set(row.slug, product)
        productsBySlug.set(row.slug, product)
        createdProductsSlugs.add(row.slug)
      }
    } else if (createdProductsSlugs.has(row.slug)) {
      const addedProduct = productsToCreate.get(row.slug)
      if (
        addedProduct &&
        ((row.name && row.name !== addedProduct.name) ||
          (categoryId && categoryId !== addedProduct.categoryId) ||
          (row.description && row.description !== addedProduct.description) ||
          (row.priceCents !== null && row.priceCents !== addedProduct.priceCents) ||
          (row.active !== null && row.active !== addedProduct.active))
      ) {
        errors.push({
          row: row.line,
          message: `Los datos del producto nuevo ${row.slug} no coinciden entre sus filas.`,
        })
      }
    } else if (!createdProductsSlugs.has(row.slug)) {
      const patch = updatesBySlug.get(row.slug) ?? { line: row.line }
      const next = { ...patch }
      if (row.name) next.name = row.name
      if (categoryId) next.categoryId = categoryId
      if (row.description) next.description = row.description
      if (row.priceCents !== null) next.priceCents = row.priceCents
      if (row.active !== null) next.active = row.active
      for (const key of ['name', 'categoryId', 'description', 'priceCents', 'active'] as const) {
        if (patch[key] !== undefined && next[key] !== patch[key]) {
          errors.push({
            row: row.line,
            message: `Los datos de producto ${row.slug} no coinciden entre sus filas.`,
          })
          break
        }
      }
      updatesBySlug.set(row.slug, next)
    }

    if (!row.sku || !row.size || !row.color) continue
    if (seenSkus.has(row.sku))
      errors.push({ row: row.line, message: `SKU duplicado en el archivo: ${row.sku}.` })
    seenSkus.add(row.sku)
    const product = productsBySlug.get(row.slug)
    if (!product) continue
    const existingVariant = skuMap.get(row.sku)
    if (existingVariant && existingVariant.productId !== product.id) {
      errors.push({ row: row.line, message: `El SKU ${row.sku} pertenece a otro producto.` })
      continue
    }
    const pairKey = `${product.id}|${row.size}|${row.color.toLowerCase()}`
    if (seenPairs.has(pairKey))
      errors.push({
        row: row.line,
        message: `La combinación ${row.size} / ${row.color} está duplicada.`,
      })
    seenPairs.add(pairKey)
    const pairOwner = catalog.variants.find(
      (variant) =>
        variant.productId === product.id &&
        variant.size === row.size &&
        variant.color.toLowerCase() === row.color.toLowerCase(),
    )
    if (pairOwner && pairOwner.sku.toUpperCase() !== row.sku) {
      errors.push({
        row: row.line,
        message: `Ya existe esa talla y color con el SKU ${pairOwner.sku}.`,
      })
      continue
    }

    const currentStock = existingVariant?.stock ?? null
    if (!existingVariant && row.stockOnHand === null && row.stockDelta === null) {
      errors.push({
        row: row.line,
        message: 'Una variante nueva necesita stock_on_hand o stock_delta.',
      })
    }
    if (existingVariant && (row.hasOnHand || row.hasDelta)) {
      const nextStock = row.hasOnHand
        ? row.stockOnHand
        : existingVariant.stock + (row.stockDelta ?? 0)
      if (nextStock === null || nextStock < 0) {
        errors.push({ row: row.line, message: `El cambio dejaría stock negativo para ${row.sku}.` })
      } else if (nextStock !== currentStock) {
        changedStocks.set(existingVariant.id, {
          next: nextStock,
          delta: nextStock - existingVariant.stock,
          reason: row.hasDelta ? 'import' : 'adjustment',
          line: row.line,
        })
      }
    } else if (!existingVariant) {
      const stock = row.hasOnHand ? row.stockOnHand : row.stockDelta
      if (stock === null) continue
      const variant: Variant = {
        id: `${product.id}-${slugify(row.color)}-${slugify(row.size)}`,
        productId: product.id,
        size: row.size,
        color: row.color,
        sku: row.sku,
        stock,
      }
      variantsToAdd.push(variant)
      skuMap.set(row.sku, variant)
      changedStocks.set(variant.id, {
        next: stock,
        delta: stock,
        reason: 'import',
        line: row.line,
      })
    }
  }

  for (const variant of variantsToAdd) {
    if (
      catalog.variants.some((item) => item.id === variant.id) ||
      variantsToAdd.filter((item) => item.id === variant.id).length > 1
    ) {
      errors.push({
        row: rows.find((row) => row.sku === variant.sku)?.line ?? 1,
        message: `El identificador calculado de ${variant.sku} ya existe.`,
      })
    }
  }

  if (errors.length > 0) {
    return {
      errors,
      catalog: null,
      movements: [],
      createdProducts: 0,
      createdVariants: 0,
      changedVariants: 0,
    }
  }

  const products = catalog.products.map((product) => {
    const patch = updatesBySlug.get(product.slug)
    return patch
      ? {
          ...product,
          ...(patch.name === undefined ? {} : { name: patch.name }),
          ...(patch.categoryId === undefined ? {} : { categoryId: patch.categoryId }),
          ...(patch.description === undefined ? {} : { description: patch.description }),
          ...(patch.priceCents === undefined ? {} : { priceCents: patch.priceCents }),
          ...(patch.active === undefined ? {} : { active: patch.active }),
        }
      : product
  })
  products.push(...productsToCreate.values())
  const variants = catalog.variants.map((variant) => {
    const change = changedStocks.get(variant.id)
    return change ? { ...variant, stock: change.next } : variant
  })
  variants.push(...variantsToAdd)
  const now = new Date().toISOString()
  const movements: InventoryMovement[] = [...changedStocks.entries()]
    .filter(([, change]) => change.delta !== 0)
    .map(([variantId, change], index) => {
      const variant = [...variants, ...catalog.variants].find((item) => item.id === variantId)
      const product = variant
        ? [...products, ...catalog.products].find((item) => item.id === variant.productId)
        : undefined
      return {
        id: `csv-${String(Date.now())}-${String(index)}-${Math.random().toString(36).slice(2, 7)}`,
        variantId,
        sku: variant?.sku ?? '',
        productName: product?.name ?? '',
        size: variant?.size ?? 'Único',
        color: variant?.color ?? '',
        delta: change.delta,
        reason: change.reason,
        note: `Importación CSV · fila ${String(change.line)}`,
        orderId: null,
        createdAt: now,
      }
    })

  return {
    errors: [],
    catalog: { ...catalog, products, variants },
    movements,
    createdProducts: productsToCreate.size,
    createdVariants: variantsToAdd.length,
    changedVariants: changedStocks.size,
  }
}
