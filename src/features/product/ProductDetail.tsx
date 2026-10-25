import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useCart } from '@/app/providers/cartContext'
import { ProductArtwork } from '@/components/ui/ProductArtwork'
import { WhatsAppActions } from '@/components/ui/WhatsAppActions'
import { buttonClassName } from '@/components/ui/button'
import { DualCurrencyPrice } from '@/components/ui/DualCurrencyPrice'
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
import type { Catalog, Product, Size } from '@/domain/types'
import {
  buildProductInquiryMessage,
  buildWhatsAppUrl,
  IS_WHATSAPP_CONFIGURED,
  STORE_WHATSAPP_NUMBER,
} from '@/lib/whatsapp'
import {
  createRemoteWhatsAppPurchaseContext,
  type RemoteWhatsAppPurchaseContext,
} from '@/data/repositories/remoteOrderGateway'
import {
  createDirectCheckoutIntent,
  resolveDirectCheckoutSelection,
} from '@/features/checkout/directCheckout'

import { ProductVariantSelector } from './ProductVariantSelector'

interface ProductDetailProps {
  readonly product: Product
  readonly catalog: Catalog
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

export function ProductDetail({ product, catalog }: ProductDetailProps) {
  const { addToCart } = useCart()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cartFeedback, setCartFeedback] = useState('')
  const [quantity, setQuantity] = useState(() => searchParams.get('cantidad') ?? '1')
  const [buyNowError, setBuyNowError] = useState('')
  const [isBuyingNow, setIsBuyingNow] = useState(false)
  const [whatsAppContext, setWhatsAppContext] = useState<RemoteWhatsAppPurchaseContext | null>(null)
  const [whatsAppContextError, setWhatsAppContextError] = useState('')
  const [isPreparingWhatsAppContext, setIsPreparingWhatsAppContext] = useState(false)

  const category = catalog.categories.find((item) => item.id === product.categoryId)
  const variants = getProductVariants(catalog.variants, product.id)
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
    setBuyNowError('')
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

  const selectedVariant = selection
    ? variants.find(
        (variant) =>
          variant.size === selection.size && variant.color === selection.color && variant.stock > 0,
      )
    : undefined

  const requestedQuantity = quantity.trim() === '' ? Number.NaN : Number(quantity)
  const quantityIsValid =
    selectedVariant !== undefined &&
    Number.isSafeInteger(requestedQuantity) &&
    requestedQuantity > 0 &&
    requestedQuantity <= selectedVariant.stock
  const quantityError =
    selectedVariant === undefined
      ? 'Elige una variante disponible.'
      : quantityIsValid
        ? ''
        : `Elige una cantidad entre 1 y ${String(selectedVariant.stock)} unidades disponibles.`

  function handleAddToCart(): void {
    if (selectedVariant === undefined || !quantityIsValid) return
    const error = addToCart(selectedVariant.id, requestedQuantity)
    setCartFeedback(error ?? 'Añadida al carrito.')
  }

  function handleBuyNow(): void {
    setBuyNowError('')
    if (selectedVariant === undefined || !quantityIsValid) {
      setBuyNowError(quantityError)
      return
    }

    const selection = resolveDirectCheckoutSelection(catalog, selectedVariant.id, requestedQuantity)
    if (selection.status !== 'ready') {
      setBuyNowError(selection.message)
      return
    }

    const intentToken = createDirectCheckoutIntent(
      selection.line.variantId,
      selection.line.quantity,
    )
    if (intentToken === null) {
      setBuyNowError(
        'No pudimos preparar la compra en esta pestaña. El carrito que ya tenías sigue intacto; inténtalo de nuevo.',
      )
      return
    }

    setIsBuyingNow(true)
    try {
      void Promise.resolve(navigate(`/checkout?compra=${encodeURIComponent(intentToken)}`)).catch(
        () => {
          setIsBuyingNow(false)
          setBuyNowError(
            'No se pudo abrir el checkout. El carrito sigue intacto; inténtalo de nuevo.',
          )
        },
      )
    } catch {
      setIsBuyingNow(false)
      setBuyNowError('No se pudo abrir el checkout. El carrito sigue intacto; inténtalo de nuevo.')
    }
  }

  async function handleWhatsAppPurchase(): Promise<void> {
    setWhatsAppContextError('')
    setWhatsAppContext(null)
    if (selectedVariant === undefined || !quantityIsValid) {
      setWhatsAppContextError(quantityError)
      return
    }
    setIsPreparingWhatsAppContext(true)
    try {
      const context = await createRemoteWhatsAppPurchaseContext({
        variantId: selectedVariant.id,
        quantity: requestedQuantity,
      })
      setWhatsAppContext(context)
    } catch (caught) {
      setWhatsAppContextError(
        caught instanceof Error
          ? caught.message
          : 'No se pudo preparar el contexto de compra para WhatsApp.',
      )
    } finally {
      setIsPreparingWhatsAppContext(false)
    }
  }

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
              <ProductArtwork
                imageUrl={product.imageUrl}
                imageAlt={product.imageAlt}
                productName={product.name}
                categoryId={product.categoryId}
                color={selectedColor ?? colors[0] ?? 'Arena'}
                className="h-full w-full drop-shadow-[0_30px_40px_rgba(92,49,34,0.16)]"
                loading="eager"
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

          <DualCurrencyPrice
            cents={product.priceCents}
            className="mt-4 items-start text-xl font-medium tabular-nums"
          />

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

            <label className="mt-6 block max-w-40 text-xs font-medium text-stone-600">
              Cantidad
              <input
                aria-invalid={!quantityIsValid}
                aria-describedby={
                  quantityIsValid
                    ? 'product-quantity-help'
                    : 'product-quantity-help product-quantity-error'
                }
                type="number"
                inputMode="numeric"
                min={1}
                max={stock}
                step={1}
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.currentTarget.value)
                  setBuyNowError('')
                }}
                className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm text-ink ring-1 ring-stone-900/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
              />
              <span id="product-quantity-help" className="mt-1 block font-normal text-stone-500">
                Máximo {String(stock)} por compra.
              </span>
              {!quantityIsValid ? (
                <span id="product-quantity-error" role="alert" className="mt-1 block text-red-800">
                  {quantityError}
                </span>
              ) : null}
            </label>
          </div>

          <div className="mt-8">
            <button
              type="button"
              disabled={!quantityIsValid}
              onClick={handleAddToCart}
              className={buttonClassName(
                'primary',
                'w-full disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              Añadir al carrito
            </button>
            <p aria-live="polite" className="mt-2 min-h-4 text-center text-xs text-stone-600">
              {cartFeedback}
            </p>
            <Link to="/carrito" className={buttonClassName('secondary', 'mt-2 w-full')}>
              Ver carrito
            </Link>
            <button
              type="button"
              disabled={!quantityIsValid || isBuyingNow}
              aria-busy={isBuyingNow}
              onClick={handleBuyNow}
              className={buttonClassName(
                'primary',
                'mt-2 w-full disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              {isBuyingNow ? 'Preparando compra…' : 'Comprar ahora'}
            </button>
            <p
              aria-live="polite"
              role={buyNowError ? 'alert' : undefined}
              className="mt-2 min-h-4 text-center text-xs text-red-800"
            >
              {buyNowError}
            </p>
            <button
              type="button"
              disabled={!quantityIsValid || isPreparingWhatsAppContext}
              aria-busy={isPreparingWhatsAppContext}
              onClick={() => void handleWhatsAppPurchase()}
              className={buttonClassName(
                'secondary',
                'mt-2 w-full disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              {isPreparingWhatsAppContext ? 'Preparando consulta…' : 'Comprar por WhatsApp'}
            </button>
            {whatsAppContextError ? (
              <p role="alert" className="mt-2 text-center text-xs text-red-800">
                {whatsAppContextError}
              </p>
            ) : null}
            {whatsAppContext ? (
              <div className="mt-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950">
                <p>
                  Contexto listo: {whatsAppContext.product.name}, talla{' '}
                  {whatsAppContext.product.size}, color {whatsAppContext.product.color}, cantidad{' '}
                  {whatsAppContext.product.quantity}. El servidor volverá a verificar precio y stock
                  cuando llegue el mensaje.
                </p>
                <p className="mt-1 text-xs">
                  La referencia vence el{' '}
                  {new Date(whatsAppContext.expiresAt).toLocaleString('es-VE')}.
                </p>
                {whatsAppContext.whatsappUrl ? (
                  <a
                    href={whatsAppContext.whatsappUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={buttonClassName('primary', 'mt-3 w-full')}
                  >
                    Abrir WhatsApp con el contexto
                  </a>
                ) : (
                  <>
                    <p className="mt-2 text-xs leading-relaxed">
                      Falta configurar el número de WhatsApp del negocio en el backend. El contexto
                      no se asociará hasta que envíes esta referencia al número de la tienda.
                    </p>
                    <WhatsAppActions
                      message={whatsAppContext.prefilledMessage}
                      label="Copiar referencia de compra"
                      variant="secondary"
                    />
                    {IS_WHATSAPP_CONFIGURED && STORE_WHATSAPP_NUMBER ? (
                      <a
                        href={buildWhatsAppUrl(
                          whatsAppContext.prefilledMessage,
                          STORE_WHATSAPP_NUMBER,
                        )}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={buttonClassName('primary', 'mt-3 w-full')}
                      >
                        Abrir WhatsApp con el contexto
                      </a>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
            <WhatsAppActions
              message={inquiryMessage}
              label="Consultar por WhatsApp"
              variant="secondary"
              disabled={stock === 0}
              disabledLabel="Agotado por ahora"
            />
            <p className="mt-3 text-center text-xs leading-relaxed text-stone-500">
              {stock > 0
                ? IS_WHATSAPP_CONFIGURED
                  ? 'Se abre WhatsApp con el mensaje listo. La disponibilidad final se confirma en la conversación.'
                  : 'Modo demo: copia el mensaje para consultarlo desde tu cuenta de WhatsApp.'
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
