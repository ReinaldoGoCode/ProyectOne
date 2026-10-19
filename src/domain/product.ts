import type { ProductId, Size, Variant } from './types'

/**
 * Orden canónico de tallas para la interfaz. `Array.prototype.sort` con este
 * índice evita que las tallas queden en orden alfabético (L, M, S, XL...).
 */
export const SIZE_ORDER: readonly Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único']

/** Variantes de un producto, sin importar su stock. */
export function getProductVariants(
  variants: readonly Variant[],
  productId: ProductId,
): readonly Variant[] {
  return variants.filter((variant) => variant.productId === productId)
}

/** Variante exacta de talla y color, o `undefined` si esa combinación no existe. */
export function findVariant(
  variants: readonly Variant[],
  productId: ProductId,
  size: Size,
  color: string,
): Variant | undefined {
  return variants.find(
    (variant) =>
      variant.productId === productId && variant.size === size && variant.color === color,
  )
}

/**
 * Stock de una combinación concreta. Devuelve 0 si la combinación no existe:
 * para la interfaz, "no existe" y "agotada" se comportan igual al comprar.
 */
export function getStockForSelection(
  variants: readonly Variant[],
  productId: ProductId,
  size: Size,
  color: string,
): number {
  return findVariant(variants, productId, size, color)?.stock ?? 0
}

/** La combinación existe y tiene al menos una unidad disponible. */
export function isCombinationAvailable(
  variants: readonly Variant[],
  productId: ProductId,
  size: Size,
  color: string,
): boolean {
  return getStockForSelection(variants, productId, size, color) > 0
}

/** Se puede agregar `quantity` de esta combinación sin superar el stock. */
export function canAddQuantity(
  variants: readonly Variant[],
  productId: ProductId,
  size: Size,
  color: string,
  quantity: number,
): boolean {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return false
  }

  return quantity <= getStockForSelection(variants, productId, size, color)
}

/** Tallas que existen para el producto, tengan stock o no, en orden canónico. */
export function listSizes(variants: readonly Variant[], productId: ProductId): readonly Size[] {
  const sizes = new Set<Size>()

  for (const variant of getProductVariants(variants, productId)) {
    sizes.add(variant.size)
  }

  return [...sizes].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b))
}

/** Tallas con al menos una unidad disponible en algún color. */
export function listAvailableSizes(
  variants: readonly Variant[],
  productId: ProductId,
): readonly Size[] {
  const sizes = new Set<Size>()

  for (const variant of getProductVariants(variants, productId)) {
    if (variant.stock > 0) {
      sizes.add(variant.size)
    }
  }

  return [...sizes].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b))
}

/**
 * Colores que existen para el producto (opcionalmente filtrados por talla),
 * tengan stock o no.
 */
export function listColors(
  variants: readonly Variant[],
  productId: ProductId,
  size?: Size,
): readonly string[] {
  const colors = new Set<string>()

  for (const variant of getProductVariants(variants, productId)) {
    if (size === undefined || variant.size === size) {
      colors.add(variant.color)
    }
  }

  return [...colors].sort((a, b) => a.localeCompare(b, 'es'))
}

/** Colores con al menos una unidad disponible (opcionalmente en una talla). */
export function listAvailableColors(
  variants: readonly Variant[],
  productId: ProductId,
  size?: Size,
): readonly string[] {
  const colors = new Set<string>()

  for (const variant of getProductVariants(variants, productId)) {
    const matchesSize = size === undefined || variant.size === size

    if (matchesSize && variant.stock > 0) {
      colors.add(variant.color)
    }
  }

  return [...colors].sort((a, b) => a.localeCompare(b, 'es'))
}

/** Suma del stock de todas las variantes del producto. */
export function getTotalStock(variants: readonly Variant[], productId: ProductId): number {
  return getProductVariants(variants, productId).reduce(
    (total, variant) => total + variant.stock,
    0,
  )
}
