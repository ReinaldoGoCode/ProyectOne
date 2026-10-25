import { Link } from 'react-router-dom'

import { useCatalog } from '@/app/providers/catalogContext'
import { useCart } from '@/app/providers/cartContext'
import { buttonClassName } from '@/components/ui/button'
import { formatMoney } from '@/domain/money'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function CartPage() {
  useDocumentTitle('Carrito · Norte Moda')
  const { catalog, catalogMode, refreshCatalog } = useCatalog()
  const { lines, isReady, summary, setQuantity, removeLine, clear } = useCart()
  const details = new Map(summary.details.map((detail) => [detail.variant.id, detail]))

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
        Tu selección
      </p>
      <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em] sm:text-5xl">Carrito</h1>

      {!isReady ? (
        catalogMode === 'error' ? (
          <div
            role="alert"
            className="mt-10 rounded-2xl bg-amber-50 p-6 text-center text-sm text-amber-950"
          >
            <p>No se pudo validar el carrito con el catálogo remoto. Tu selección se conserva.</p>
            <button
              type="button"
              onClick={() => void refreshCatalog()}
              className="mt-4 underline underline-offset-4"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <p
            role="status"
            className="mt-10 rounded-2xl bg-white/60 p-6 text-center text-sm text-stone-600"
          >
            Preparando el carrito con el catálogo actual…
          </p>
        )
      ) : lines.length === 0 ? (
        <div className="mt-10 rounded-3xl bg-white/60 p-8 text-center ring-1 ring-stone-900/8 sm:p-12">
          <h2 className="text-2xl font-medium">Tu carrito está vacío</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stone-600">
            Explora el catálogo y elige una talla y un color para empezar tu pedido.
          </p>
          <Link to="/catalogo" className={buttonClassName('primary', 'mt-7')}>
            Volver al catálogo
          </Link>
        </div>
      ) : (
        <div className="mt-9 grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start">
          <div>
            {summary.issues.length > 0 ? (
              <div
                role="status"
                className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-900/10"
              >
                <p className="font-medium">Revisa la disponibilidad de tu carrito</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {summary.issues.map((issue) => (
                    <li key={`${issue.variantId}-${issue.code}`}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <ul className="divide-y divide-stone-900/10 border-y border-stone-900/10">
              {lines.map((line) => {
                const detail = details.get(line.variantId)
                const variant = catalog.variants.find((item) => item.id === line.variantId)
                const product = variant
                  ? catalog.products.find((item) => item.id === variant.productId)
                  : undefined
                const issue = summary.issues.find((item) => item.variantId === line.variantId)
                const productName = product?.name ?? 'esta prenda'

                return (
                  <li
                    key={line.variantId}
                    className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      {product?.active ? (
                        <Link
                          to={`/producto/${product.slug}`}
                          className="font-medium transition-colors hover:text-brand-800"
                        >
                          {product.name}
                        </Link>
                      ) : (
                        <p className="font-medium">{product?.name ?? 'Prenda no disponible'}</p>
                      )}
                      <p className="mt-1 text-sm text-stone-600">
                        {variant
                          ? `Talla ${variant.size} · ${variant.color}`
                          : 'Variante no disponible'}
                      </p>
                      {issue ? (
                        <p className="mt-2 text-xs text-amber-800">{issue.message}</p>
                      ) : null}
                    </div>

                    {detail ? (
                      <>
                        <div
                          className="flex items-center gap-2"
                          aria-label={`Cantidad de ${productName}`}
                        >
                          <button
                            type="button"
                            aria-label={`Reducir ${productName} en uno`}
                            onClick={() => {
                              setQuantity(line.variantId, line.quantity - 1)
                            }}
                            className="grid size-10 place-items-center rounded-full ring-1 ring-stone-900/15 hover:bg-white"
                          >
                            −
                          </button>
                          <span aria-live="polite" className="w-8 text-center text-sm tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Aumentar ${productName} en uno`}
                            disabled={line.quantity >= detail.maxQuantity}
                            onClick={() => {
                              setQuantity(line.variantId, line.quantity + 1)
                            }}
                            className="grid size-10 place-items-center rounded-full ring-1 ring-stone-900/15 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                        <p className="min-w-24 text-right text-sm font-medium tabular-nums">
                          {formatMoney(detail.lineTotalCents)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-stone-500">{line.quantity} en carrito</p>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        removeLine(line.variantId)
                      }}
                      className="self-start text-xs text-stone-500 underline underline-offset-4 hover:text-ink sm:self-auto"
                    >
                      Quitar
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <Link
                to="/catalogo"
                className="text-sm text-stone-600 underline underline-offset-4 hover:text-ink"
              >
                Seguir explorando
              </Link>
              <button
                type="button"
                onClick={clear}
                className="text-sm text-stone-500 underline underline-offset-4 hover:text-ink"
              >
                Vaciar carrito
              </button>
            </div>
          </div>

          <aside className="rounded-3xl bg-white/65 p-6 ring-1 ring-stone-900/8 sm:p-7">
            <h2 className="text-lg font-medium">Resumen</h2>
            <div className="mt-5 flex justify-between gap-4 text-sm text-stone-600">
              <span>{summary.itemCount} artículos</span>
              <span className="font-medium tabular-nums text-ink">
                {formatMoney(summary.subtotalCents)}
              </span>
            </div>
            <p className="mt-4 border-t border-stone-900/10 pt-4 text-xs leading-relaxed text-stone-500">
              La entrega se coordina en el siguiente paso. Los precios son de demostración y no se
              procesa ningún pago.
            </p>
            <Link
              to="/checkout"
              aria-disabled={!summary.canCheckout}
              tabIndex={summary.canCheckout ? undefined : -1}
              className={buttonClassName(
                'primary',
                `mt-6 w-full ${summary.canCheckout ? '' : 'pointer-events-none opacity-40'}`,
              )}
            >
              Continuar al checkout
            </Link>
            {!summary.canCheckout ? (
              <p className="mt-3 text-center text-xs text-stone-500">
                {summary.issues.length > 0
                  ? 'Corrige la disponibilidad antes de continuar.'
                  : 'Añade una prenda disponible para continuar.'}
              </p>
            ) : null}
          </aside>
        </div>
      )}
    </section>
  )
}
