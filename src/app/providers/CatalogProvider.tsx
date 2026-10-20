import { useState } from 'react'
import type { ReactNode } from 'react'

import { seedCatalog } from '@/data/seed'
import { createCatalogRepository } from '@/data/repositories/catalogRepository'
import type { Catalog, Product, ProductId, Variant } from '@/domain/types'
import { slugify } from '@/lib/text'

import { CatalogContext } from './catalogContext'
import type { ProductInput, VariantInput } from './catalogContext'

const PLACEHOLDER_IMAGE = '/images/products/placeholder.svg'

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

export function CatalogProvider({ children }: { readonly children: ReactNode }) {
  const [repository] = useState(() => createCatalogRepository())
  const [catalog, setCatalog] = useState(() => repository.load())

  function commit(next: Catalog): void {
    if (!repository.save(next)) {
      throw new Error('No se pudo guardar el catálogo en este navegador.')
    }
    setCatalog(next)
  }

  function createProduct(input: ProductInput): Product {
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
    commit({
      ...catalog,
      products: catalog.products.map((product) =>
        product.id === id ? { ...product, active } : product,
      ),
    })
  }

  function saveVariant(input: VariantInput): void {
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

    commit({
      ...catalog,
      variants: existing
        ? catalog.variants.map((item) => (item.id === variant.id ? variant : item))
        : [...catalog.variants, variant],
    })
  }

  function deleteVariant(id: string): void {
    commit({
      ...catalog,
      variants: catalog.variants.filter((variant) => variant.id !== id),
    })
  }

  function resetCatalog(): void {
    repository.reset()
    setCatalog(seedCatalog)
  }

  return (
    <CatalogContext.Provider
      value={{
        catalog,
        createProduct,
        updateProduct,
        setProductActive,
        saveVariant,
        deleteVariant,
        resetCatalog,
      }}
    >
      {children}
    </CatalogContext.Provider>
  )
}
