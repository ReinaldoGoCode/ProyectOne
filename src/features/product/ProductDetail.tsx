import { Link, useSearchParams } from 'react-router-dom'

import { GarmentArt } from '@/components/ui/GarmentArt'
import { WhatsAppActions } from '@/components/ui/WhatsAppActions'
import { seedCategories, seedVariants } from '@/data/seed'
import { formatMoney } from '@/domain/money'
import {
  findFirstAvailableSelection,
  getAvailableSizesForColor,
  getProductVariants,
  getStockForSelection,
  isCombinationAvailable,
  listAvailableColors,
  listColors,
  listSizes,
} from '@/domain/product'
import type { Product, Size } from '@/domain/types'
import { buildProductInquiryMessage } from '@/lib/whatsapp'

import { ProductVariantSelector } from './ProductVariantSelector'

interface ProductDetailProps {
  readonly product: Product
}

function describeStock(stock: number): string {
  if (stock === 0) {
    return 'Agotado'
  }

  if (stock === 1) {
    return 'Última unidad disponible'
  }

  if (stock <= 3) {
    return `Últimas ${String(stock)} unidades disponibles`
  }

  return `${String(stock)} unidades disponibles`
}

export function ProductDetail({ product }: ProductDetailProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const category = seedCategories.find((item) => item.id === product.categoryId)
  const variants = getProductVariants(seedVariants, product.id)
  const sizes = listSizes(variants, product.id)
  const colors = listColors(variants, product.id)
  const colorsWithStock = new Set(listAvailableColors(variants, product.id))
  const fallbackSelection = findFirstAvailableSelection(variants, product.id)

  const requestedSize = sizes.find((size) => size === searchParams.get('talla'))
  const requestedColor = colors.find((color) => color === searchParams.get('color'))
  const requestedSelection =
    requestedSize !== undefined &&
    requestedColor !== undefined &&
    isCombinationAvailable(variants, product.id, requestedSize, requestedColor)
      ? { size: requestedSize, color: requestedColor }
      : null

  const selection = requestedSelection ?? fallbackSelection
  const selectedSize = selection?.size ?? null
  const selectedColor = selection?.color ?? null

  const stock = selection
    ? getStockForSelection(variants, product.id, selection.size, selection.color)
    : 0

  const availableSizes =
    selectedColor === null ? [] : getAvailableSizesForColor(variants, product.id, selectedColor)

  function applySelection(next: { readonly size: Size; readonly color: string }): void {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('talla', next.size)
    nextParams.set('color', next.color)
    setSearchParams(nextParams, { replace: true, preventScrollReset: true })
  }

  function handleColor(color: string): void {
    if (!colorsWithStock.has(color)) {
      return
    }

    const sizesForColor = getAvailableSizesForColor(variants, product.id, color)
    const nextSize =
      selectedSize !== null && sizesForColor.includes(selectedSize)
        ? selectedSize
        : sizesForColor[0]

    if (nextSize === undefined) {
      return
    }

    applySelection({ size: nextSize, color })
  }

  function handleSize(size: Size): void {
    if (selectedColor === null || !availableSizes.includes(size)) {
      return
    }

    applySelection({ size, color: selectedColor })
  }

  const inquiryMessage = selection
    ? buildProductInquiryMessage({
        productName: product.name,
        size: selection.size,
        color: selection.color,
        priceCents: product.priceCents,
      })
    : ''

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <nav
        aria-label="Ruta de navegación"
        className="mb-8 flex flex-wrap items-center gap-2 text-xs text-stone-500"
      >
        <Link to="/catalogo" className="transition-colors duration-200 hover:text-ink">
          Catálogo
        </Link>
        {category ? (
          <>
            <span aria-hidden="true">/</span>
            <Link
              to={`/catalogo?categoria=${category.slug}`}
              className="transition-colors duration-200 hover:text-ink"
            >
              {category.name}
            </Link>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span className="text-stone-700">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-16">
        <div className="lg:sticky lg:top-24">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-brand-200 via-brand-100 to-sand p-8 ring-1 ring-stone-900/5 sm:p-12">
            <div className="aspect-[4/5]">
              <GarmentArt
                categoryId={product.categoryId}
                color={selectedColor ?? colors[0] ?? 'Arena'}
                className="h-full w-full drop-shadow-[0_30px_40px_rgba(92,49,34,0.16)]"
              />
            </div>

            {stock === 0 ? (
              <span className="absolute top-5 left-5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium tracking-[0.1em] text-stone-600 uppercase backdrop-blur">
                Agotado
              </span>
            ) : null}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[11px] font-medium tracking-[0.18em] text-brand-700 uppercase">
              {category?.name ?? 'Norte Moda'}
            </p>
          </div>

          <h1 className="mt-4 text-4xl font-medium tracking-[-0.04em] text-balance sm:text-5xl">
            {product.name}
          </h1>

          <p className="mt-4 text-xl font-medium tabular-nums">{formatMoney(product.priceCents)}</p>

          <p className="mt-5 max-w-prose text-base leading-relaxed text-stone-600">
            {product.description}
          </p>

          <div className="mt-8 border-t border-stone-900/10 pt-8">
            <ProductVariantSelector
              sizes={sizes}
              colors={colors}
              selectedSize={selectedSize}
              selectedColor={selectedColor}
              availableSizes={availableSizes}
              availableColors={colorsWithStock}
              onSelectSize={handleSize}
              onSelectColor={handleColor}
            />

            <div className="mt-6 flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${
                  stock === 0 ? 'bg-stone-400' : stock <= 3 ? 'bg-amber-500' : 'bg-emerald-600'
                }`}
              />
              <p aria-live="polite" className="text-sm text-stone-600">
                {describeStock(stock)}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <WhatsAppActions
              message={inquiryMessage}
              label="Consultar por WhatsApp"
              disabled={stock === 0}
              disabledLabel="Agotado por ahora"
            />
            <p className="mt-3 text-center text-xs leading-relaxed text-stone-500">
              {stock > 0
                ? 'Se abre WhatsApp con el mensaje listo. La disponibilidad final se confirma en la conversación.'
                : 'Vuelve al catálogo o consúltanos por otra prenda.'}
            </p>
          </div>

          <dl className="mt-10 border-t border-stone-900/10 text-sm">
            <div className="flex justify-between gap-8 border-b border-stone-900/10 py-4">
              <dt className="shrink-0 text-stone-500">Composición</dt>
              <dd className="text-right">{product.composition}</dd>
            </div>
            <div className="flex justify-between gap-8 border-b border-stone-900/10 py-4">
              <dt className="shrink-0 text-stone-500">Cuidados</dt>
              <dd className="text-right">{product.care}</dd>
            </div>
          </dl>

          <Link
            to="/catalogo"
            className="group mt-8 inline-flex items-center gap-2 text-sm font-medium text-ink"
          >
            <span
              aria-hidden="true"
              className="transition-transform duration-300 ease-out group-hover:-translate-x-0.5"
            >
              ←
            </span>
            Volver al catálogo
          </Link>
        </div>
      </div>
    </section>
  )
}
