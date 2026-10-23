import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { seedCatalog } from '@/data/seed'
import { planInventoryCsv } from '@/data/inventoryCsv'
import { createCatalogRepository } from '@/data/repositories/catalogRepository'
import { loadRemotePublicCatalog } from '@/data/repositories/remoteOrderGateway'
import { deductStockForOrder } from '@/domain/inventory'
import type { Catalog, InventoryMovement, Order, Product, ProductId, Variant } from '@/domain/types'
import { slugify } from '@/lib/text'
import { isSupabaseBrowserConfigured } from '@/lib/supabase'

import { CatalogContext } from './catalogContext'
import type { ProductInput, VariantInput } from './catalogContext'

const PLACEHOLDER_IMAGE = '/images/products/placeholder.svg'
const EMPTY_CATALOG: Catalog = { categories: [], products: [], variants: [] }

function validateProduct(input: ProductInput, catalog: Catalog): ProductInput {
  const name = input.name.trim()

  if (name.length < 2) {
    throw new Error('El nombre del producto necesita al menos 2 caracteres.')
  }

  if (!catalog.categories.some((category) => category.id === input.categoryId)) {
    throw new Error('Elegí una categoría válida.')
  }

  if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) {
    throw new Error('El precio debe ser mayor que cero.')
  }

  return {
    ...input,
    name,
    description: input.description.trim(),
    composition: input.composition.trim(),
    care: input.care.trim(),
  }
}

function normalizeColor(color: string): string {
  return color.trim().toLowerCase()
}

function movementId(): string {
  return `stock-${globalThis.crypto.randomUUID()}`
}

function createMovement(input: Omit<InventoryMovement, 'id' | 'createdAt'>): InventoryMovement {
  return { ...input, id: movementId(), createdAt: new Date().toISOString() }
}

export function CatalogProvider({ children }: { readonly children: ReactNode }) {
  const [repository] = useState(() => createCatalogRepository())
  const [remoteConfigured] = useState(() => isSupabaseBrowserConfigured())
  const [catalog, setCatalog] = useState(() =>
    remoteConfigured ? EMPTY_CATALOG : repository.load(),
  )
  const [catalogMode, setCatalogMode] = useState<'demo' | 'loading' | 'connected' | 'error'>(
    remoteConfigured ? 'loading' : 'demo',
  )
  const [inventoryMovements, setInventoryMovements] = useState(() =>
    remoteConfigured ? [] : repository.loadInventoryMovements(),
  )

  const refreshCatalog = useCallback(async () => {
    if (!remoteConfigured) return
    setCatalogMode('loading')
    try {
      const nextCatalog = await loadRemotePublicCatalog()
      setCatalog(nextCatalog)
      setCatalogMode('connected')
    } catch {
      setCatalog(EMPTY_CATALOG)
      setCatalogMode('error')
    }
  }, [remoteConfigured])

  useEffect(() => {
    if (!remoteConfigured) return
    let mounted = true
    void loadRemotePublicCatalog()
      .then((nextCatalog) => {
        if (mounted) {
          setCatalog(nextCatalog)
          setCatalogMode('connected')
        }
      })
      .catch(() => {
        if (mounted) {
          setCatalog(EMPTY_CATALOG)
          setCatalogMode('error')
        }
      })
    return () => {
      mounted = false
    }
  }, [remoteConfigured])

  function ensureLocalDemo(): void {
    if (catalogMode !== 'demo') {
      throw new Error('El catálogo remoto se administra desde el panel seguro en /admin.')
    }
  }

  function commit(next: Catalog, additions: readonly InventoryMovement[] = []): void {
    ensureLocalDemo()
    const nextMovements = [...inventoryMovements, ...additions].slice(-2000)
    if (!repository.saveSnapshot(next, nextMovements)) {
      throw new Error('No se pudo guardar el catálogo en este navegador.')
    }
    setCatalog(next)
    setInventoryMovements(nextMovements)
  }

  function createProduct(input: ProductInput): Product {
    ensureLocalDemo()
    const valid = validateProduct(input, catalog)
    const baseSlug = slugify(valid.name)
    let slug = baseSlug
    let suffix = 2

    while (catalog.products.some((product) => product.slug === slug)) {
      slug = `${baseSlug}-${String(suffix)}`
      suffix += 1
    }

    const product: Product = {
      id: slug,
      slug,
      name: valid.name,
      categoryId: valid.categoryId,
      description: valid.description,
      composition: valid.composition,
      care: valid.care,
      priceCents: valid.priceCents,
      imageUrl: PLACEHOLDER_IMAGE,
      imageAlt: `${valid.name}: imagen de referencia de la prenda`,
      active: valid.active,
      createdAt: new Date().toISOString(),
    }

    commit({ ...catalog, products: [...catalog.products, product] })
    return product
  }

  function updateProduct(id: ProductId, input: ProductInput): void {
    ensureLocalDemo()
    const current = catalog.products.find((product) => product.id === id)

    if (current === undefined) {
      throw new Error('El producto ya no existe.')
    }

    const valid = validateProduct(input, catalog)
    const updated: Product = {
      ...current,
      name: valid.name,
      categoryId: valid.categoryId,
      description: valid.description,
      composition: valid.composition,
      care: valid.care,
      priceCents: valid.priceCents,
      active: valid.active,
    }

    commit({
      ...catalog,
      products: catalog.products.map((product) => (product.id === id ? updated : product)),
    })
  }

  function setProductActive(id: ProductId, active: boolean): void {
    ensureLocalDemo()
    commit({
      ...catalog,
      products: catalog.products.map((product) =>
        product.id === id ? { ...product, active } : product,
      ),
    })
  }

  function saveVariant(input: VariantInput): void {
    ensureLocalDemo()
    const product = catalog.products.find((item) => item.id === input.productId)

    if (product === undefined) {
      throw new Error('El producto ya no existe.')
    }

    const color = input.color.trim()
    const sku = input.sku.trim().toUpperCase()
    const { stock, size } = input

    if (color === '') {
      throw new Error('El color no puede estar vacío.')
    }

    if (sku === '') {
      throw new Error('El SKU no puede estar vacío.')
    }

    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error('El stock debe ser un entero mayor o igual a 0.')
    }

    const existing = input.id
      ? catalog.variants.find((variant) => variant.id === input.id)
      : undefined

    if (input.id !== undefined && existing === undefined) {
      throw new Error('La variante ya no existe.')
    }

    const duplicate = catalog.variants.find(
      (variant) =>
        variant.id !== input.id &&
        variant.productId === input.productId &&
        variant.size === size &&
        normalizeColor(variant.color) === normalizeColor(color),
    )

    if (duplicate !== undefined) {
      throw new Error('Ya existe una variante con esa talla y ese color.')
    }

    const duplicateSku = catalog.variants.find(
      (variant) => variant.id !== input.id && variant.sku.toUpperCase() === sku,
    )

    if (duplicateSku !== undefined) {
      throw new Error('Ese SKU ya está en uso por otra variante.')
    }

    const id = existing?.id ?? `${input.productId}-${slugify(color)}-${slugify(size)}`

    if (existing === undefined && catalog.variants.some((variant) => variant.id === id)) {
      throw new Error('Ya existe una variante con ese identificador.')
    }

    const variant: Variant = {
      id,
      productId: input.productId,
      size,
      color,
      sku,
      stock,
    }

    const stockDelta = stock - (existing?.stock ?? 0)
    const movement =
      stockDelta === 0
        ? []
        : [
            createMovement({
              variantId: variant.id,
              sku: variant.sku,
              productName: product.name,
              size: variant.size,
              color: variant.color,
              delta: stockDelta,
              reason: existing ? 'adjustment' : 'receipt',
              note: existing ? 'Ajuste manual desde administración.' : 'Stock inicial de variante.',
              orderId: null,
            }),
          ]

    commit(
      {
        ...catalog,
        variants: existing
          ? catalog.variants.map((item) => (item.id === variant.id ? variant : item))
          : [...catalog.variants, variant],
      },
      movement,
    )
  }

  function deleteVariant(id: string): void {
    ensureLocalDemo()
    const variant = catalog.variants.find((item) => item.id === id)
    const product = variant ? catalog.products.find((item) => item.id === variant.productId) : null
    const movement =
      variant && product && variant.stock > 0
        ? [
            createMovement({
              variantId: variant.id,
              sku: variant.sku,
              productName: product.name,
              size: variant.size,
              color: variant.color,
              delta: -variant.stock,
              reason: 'adjustment',
              note: 'Existencias retiradas al eliminar la variante.',
              orderId: null,
            }),
          ]
        : []
    commit(
      {
        ...catalog,
        variants: catalog.variants.filter((variant) => variant.id !== id),
      },
      movement,
    )
  }

  function applyInventoryCsv(csvText: string) {
    ensureLocalDemo()
    const plan = planInventoryCsv(catalog, csvText)
    if (!plan.catalog) {
      const firstError = plan.errors[0]
      throw new Error(
        firstError
          ? `Fila ${String(firstError.row)}: ${firstError.message}`
          : 'El archivo no es válido.',
      )
    }
    commit(plan.catalog, plan.movements)
    return {
      createdProducts: plan.createdProducts,
      createdVariants: plan.createdVariants,
      changedVariants: plan.changedVariants,
      movements: plan.movements.length,
    }
  }

  function resetCatalog(): void {
    ensureLocalDemo()
    repository.reset()
    setCatalog(seedCatalog)
    setInventoryMovements([])
  }

  function consumeStockForOrder(order: Order): boolean {
    const next = deductStockForOrder(catalog, order.items)
    if (next === null) return false
    const quantities = new Map<string, number>()
    for (const item of order.items) {
      quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity)
    }
    const movements = [...quantities.entries()].flatMap(([variantId, quantity]) => {
      const variant = catalog.variants.find((item) => item.id === variantId)
      const product = variant
        ? catalog.products.find((item) => item.id === variant.productId)
        : null
      return variant && product
        ? [
            createMovement({
              variantId,
              sku: variant.sku,
              productName: product.name,
              size: variant.size,
              color: variant.color,
              delta: -quantity,
              reason: 'sale',
              note: `Salida por pedido ${order.code}.`,
              orderId: order.id,
            }),
          ]
        : []
    })
    commit(next, movements)
    return true
  }

  return (
    <CatalogContext.Provider
      value={{
        catalog,
        catalogMode,
        refreshCatalog,
        inventoryMovements,
        createProduct,
        updateProduct,
        setProductActive,
        saveVariant,
        deleteVariant,
        applyInventoryCsv,
        resetCatalog,
        consumeStockForOrder,
      }}
    >
      {children}
    </CatalogContext.Provider>
  )
}
