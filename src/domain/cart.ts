import { multiplyCents } from './money'
import type { Catalog, CartLine, Product, Variant } from './types'

export type CartIssueCode =
  'missing_variant' | 'inactive_product' | 'out_of_stock' | 'quantity_reduced'

export interface CartIssue {
  readonly variantId: string
  readonly code: CartIssueCode
  readonly message: string
  readonly productName: string
}

export interface CartLineDetail {
  readonly product: Product
  readonly variant: Variant
  readonly quantity: number
  readonly lineTotalCents: number
  readonly maxQuantity: number
}

export interface CartSummary {
  readonly details: readonly CartLineDetail[]
  readonly issues: readonly CartIssue[]
  readonly subtotalCents: number
  readonly itemCount: number
  readonly canCheckout: boolean
}

export interface CartRevalidation {
  readonly lines: readonly CartLine[]
  readonly issues: readonly CartIssue[]
}

function validQuantity(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function findVariant(catalog: Catalog, variantId: string): Variant | undefined {
  return catalog.variants.find((variant) => variant.id === variantId)
}

function findProduct(catalog: Catalog, productId: string): Product | undefined {
  return catalog.products.find((product) => product.id === productId)
}

/** Agrega o incrementa una línea, siempre dentro del stock disponible. */
export function addCartLine(
  lines: readonly CartLine[],
  variantId: string,
  quantity: number,
  stock: number,
): readonly CartLine[] {
  if (!Number.isInteger(quantity) || quantity <= 0 || stock <= 0) {
    return lines
  }

  const existing = lines.find((line) => line.variantId === variantId)
  const nextQuantity = Math.min((existing?.quantity ?? 0) + quantity, stock)

  if (existing === undefined) {
    return [...lines, { variantId, quantity: nextQuantity }]
  }

  return lines.map((line) =>
    line.variantId === variantId ? { ...line, quantity: nextQuantity } : line,
  )
}

/** Fija la cantidad de una línea. Cero o menos elimina la línea. */
export function setCartQuantity(
  lines: readonly CartLine[],
  variantId: string,
  quantity: number,
  stock: number,
): readonly CartLine[] {
  if (!Number.isInteger(quantity)) {
    return lines
  }

  if (quantity <= 0) {
    return removeCartLine(lines, variantId)
  }

  return lines.map((line) =>
    line.variantId === variantId
      ? { ...line, quantity: Math.min(quantity, Math.max(stock, 1)) }
      : line,
  )
}

export function removeCartLine(lines: readonly CartLine[], variantId: string): readonly CartLine[] {
  return lines.filter((line) => line.variantId !== variantId)
}

export function clearCartLines(): readonly CartLine[] {
  return []
}

/**
 * Valida las líneas contra el catálogo vigente. Quita lo que ya no se puede
 * vender y recorta cantidades por encima del stock, dejando un motivo para
 * poder avisar en la interfaz.
 */
export function revalidateCart(lines: readonly CartLine[], catalog: Catalog): CartRevalidation {
  const nextLines: CartLine[] = []
  const issues: CartIssue[] = []

  for (const line of lines) {
    const variant = findVariant(catalog, line.variantId)

    if (variant === undefined) {
      issues.push({
        variantId: line.variantId,
        code: 'missing_variant',
        message: 'Una prenda del carrito ya no está disponible y se quitó.',
        productName: 'Prenda no disponible',
      })
      continue
    }

    const product = findProduct(catalog, variant.productId)

    if (!product?.active) {
      issues.push({
        variantId: line.variantId,
        code: 'inactive_product',
        message: `${product?.name ?? 'Una prenda'} ya no está a la venta y se quitó del carrito.`,
        productName: product?.name ?? 'Prenda no disponible',
      })
      continue
    }

    if (variant.stock <= 0) {
      issues.push({
        variantId: line.variantId,
        code: 'out_of_stock',
        message: `${product.name} (${variant.size}, ${variant.color}) está agotada y se quitó del carrito.`,
        productName: product.name,
      })
      continue
    }

    if (line.quantity > variant.stock) {
      issues.push({
        variantId: line.variantId,
        code: 'quantity_reduced',
        message: `Ajustamos ${product.name} a ${String(variant.stock)} unidades por el stock disponible.`,
        productName: product.name,
      })
      nextLines.push({ variantId: line.variantId, quantity: variant.stock })
      continue
    }

    if (line.quantity > 0) {
      nextLines.push(line)
    }
  }

  return { lines: nextLines, issues }
}

/** Resume el carrito para la interfaz y el checkout. */
export function summarizeCart(lines: readonly CartLine[], catalog: Catalog): CartSummary {
  const { lines: validLines, issues } = revalidateCart(lines, catalog)

  const details: CartLineDetail[] = []

  for (const line of validLines) {
    const variant = findVariant(catalog, line.variantId)

    if (variant === undefined) {
      continue
    }

    const product = findProduct(catalog, variant.productId)

    if (product === undefined) {
      continue
    }

    details.push({
      product,
      variant,
      quantity: line.quantity,
      lineTotalCents: multiplyCents(product.priceCents, line.quantity),
      maxQuantity: variant.stock,
    })
  }

  return {
    details,
    issues,
    subtotalCents: details.reduce((total, detail) => total + detail.lineTotalCents, 0),
    itemCount: details.reduce((total, detail) => total + detail.quantity, 0),
    canCheckout: details.length > 0 && issues.length === 0,
  }
}

/**
 * Recupera el carrito desde almacenamiento. Cualquier dato incompleto,
 * duplicado o inválido se descarta en lugar de romper la aplicación.
 */
export function sanitizeCartLines(raw: unknown, catalog: Catalog): readonly CartLine[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const entries: readonly unknown[] = raw as readonly unknown[]
  const quantities = new Map<string, number>()

  for (const item of entries) {
    if (typeof item !== 'object' || item === null) {
      continue
    }

    const variantId =
      'variantId' in item && typeof item.variantId === 'string' ? item.variantId : null
    const quantity = 'quantity' in item ? validQuantity(item.quantity) : null

    if (variantId === null || quantity === null) {
      continue
    }

    const variant = findVariant(catalog, variantId)
    const product = variant ? findProduct(catalog, variant.productId) : undefined

    if (variant === undefined || product === undefined || !product.active || variant.stock <= 0) {
      continue
    }

    const nextQuantity = Math.min((quantities.get(variantId) ?? 0) + quantity, variant.stock)
    quantities.set(variantId, nextQuantity)
  }

  return [...quantities.entries()].map(([variantId, quantity]) => ({ variantId, quantity }))
}
