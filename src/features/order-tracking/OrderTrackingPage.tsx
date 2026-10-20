import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useOrders } from '@/app/providers/orderContext'
import { buttonClassName } from '@/components/ui/button'
import {
  DELIVERY_METHOD_LABELS,
  FULFILLMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/domain/labels'
import { findOrderByCode } from '@/domain/order'
import { formatMoney } from '@/domain/money'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function OrderTrackingPage() {
  useDocumentTitle('Consulta de pedido · Norte Moda')
  const { orders } = useOrders()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const code = params.get('codigo') ?? ''
  const [input, setInput] = useState(code)
  const [copied, setCopied] = useState(false)
  const [manualSummary, setManualSummary] = useState('')
  const order = code ? findOrderByCode(orders, code) : undefined
  const justCreated = params.get('creado') === '1'

  function search(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault()
    const normalized = input.trim().toUpperCase()
    void navigate(normalized ? `/pedido?codigo=${encodeURIComponent(normalized)}` : '/pedido')
  }

  async function copySummary(): Promise<void> {
    if (!order) return
    const lines = order.items.map(
      (item) =>
        `• ${String(item.quantity)} × ${item.productName} · Talla ${item.size} · ${item.color}`,
    )
    const summary = [
      `Norte Moda · Pedido ${order.code}`,
      ...lines,
      `Pago: ${PAYMENT_STATUS_LABELS[order.paymentStatus]}`,
      `Preparación y entrega: ${FULFILLMENT_STATUS_LABELS[order.fulfillmentStatus]}`,
      `Total: ${formatMoney(order.totalCents)}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      setManualSummary('')
    } catch {
      setCopied(false)
      setManualSummary(summary)
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
        Seguimiento
      </p>
      <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em] sm:text-5xl">
        Consulta tu pedido
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone-600">
        Escribe el código que aparece en la confirmación. Esta demostración consulta los pedidos
        guardados en este navegador.
      </p>

      <form onSubmit={search} className="mt-7 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="order-code" className="sr-only">
          Código de pedido
        </label>
        <input
          id="order-code"
          value={input}
          onChange={(event) => {
            setInput(event.currentTarget.value)
          }}
          placeholder="NM-0001"
          autoComplete="off"
          className="min-h-12 flex-1 rounded-full bg-white px-5 text-sm ring-1 ring-stone-900/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        />
        <button type="submit" className={buttonClassName('primary')}>
          Buscar pedido
        </button>
      </form>

      {code && !order ? (
        <div role="status" className="mt-7 rounded-2xl bg-white/70 p-5 ring-1 ring-stone-900/10">
          <h2 className="font-medium">No encontramos ese pedido en este navegador</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Revisa el código. Si se creó en otro navegador o dispositivo, esta demo local no puede
            consultarlo.
          </p>
        </div>
      ) : null}

      {order ? (
        <article className="mt-8 rounded-3xl bg-white/70 p-5 ring-1 ring-stone-900/10 sm:p-8">
          {justCreated ? (
            <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">
              Pedido guardado en este navegador. Guarda el código para volver a consultarlo en esta
              misma demo.
            </p>
          ) : null}
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-900/10 pb-5">
            <div>
              <p className="text-xs tracking-[0.14em] text-stone-500 uppercase">Pedido</p>
              <h2 className="mt-1 text-2xl font-medium">{order.code}</h2>
              <p className="mt-2 text-xs text-stone-500">
                Creado {new Date(order.createdAt).toLocaleString('es-VE')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copySummary()}
              className={buttonClassName('secondary')}
            >
              {copied ? 'Resumen copiado' : 'Copiar resumen'}
            </button>
          </header>
          {manualSummary ? (
            <label className="mt-4 block text-xs font-medium text-stone-600">
              Selecciona y copia el resumen
              <textarea
                readOnly
                rows={6}
                value={manualSummary}
                onFocus={(event) => {
                  event.currentTarget.select()
                }}
                className="mt-2 w-full rounded-xl bg-paper p-3 font-mono text-xs leading-relaxed"
              />
            </label>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-paper p-4">
              <p className="text-xs text-stone-500">Estado de pago</p>
              <p className="mt-1 font-medium">{PAYMENT_STATUS_LABELS[order.paymentStatus]}</p>
            </div>
            <div className="rounded-2xl bg-paper p-4">
              <p className="text-xs text-stone-500">Preparación y entrega</p>
              <p className="mt-1 font-medium">
                {FULFILLMENT_STATUS_LABELS[order.fulfillmentStatus]}
              </p>
            </div>
          </div>

          <div className="mt-7">
            <h3 className="font-medium">Artículos</h3>
            <ul className="mt-3 divide-y divide-stone-900/10 border-y border-stone-900/10">
              {order.items.map((item, index) => (
                <li
                  key={`${item.variantId}-${String(index)}`}
                  className="flex justify-between gap-4 py-4 text-sm"
                >
                  <span>
                    {item.quantity} × {item.productName}
                    <span className="mt-1 block text-xs text-stone-500">
                      Talla {item.size} · Color {item.color}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatMoney(item.unitPriceCents * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <p className="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span>{formatMoney(order.subtotalCents)}</span>
            </p>
            <p className="flex justify-between text-stone-600">
              <span>Entrega · {DELIVERY_METHOD_LABELS[order.deliveryMethod]}</span>
              <span>{formatMoney(order.shippingCents)}</span>
            </p>
            <p className="flex justify-between border-t border-stone-900/10 pt-3 text-base font-medium">
              <span>Total</span>
              <span>{formatMoney(order.totalCents)}</span>
            </p>
            <p className="pt-2 text-xs text-stone-500">
              Pago previsto: {PAYMENT_METHOD_LABELS[order.paymentMethod]}
            </p>
          </div>

          <div className="mt-7 border-t border-stone-900/10 pt-5">
            <h3 className="font-medium">Historial</h3>
            <ol className="mt-3 space-y-3">
              {order.history.map((event) => (
                <li key={event.id} className="border-l border-stone-900/15 pl-3 text-sm">
                  <p>
                    {event.axis === 'payment'
                      ? `Pago: ${PAYMENT_STATUS_LABELS[event.to]}`
                      : `Preparación y entrega: ${FULFILLMENT_STATUS_LABELS[event.to]}`}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {new Date(event.at).toLocaleString('es-VE')}
                    {event.note ? ` · ${event.note}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </article>
      ) : null}

      <div className="mt-7 flex flex-wrap gap-5 text-sm">
        <Link to="/catalogo" className="text-stone-600 underline underline-offset-4 hover:text-ink">
          Volver al catálogo
        </Link>
        <Link
          to="/admin/pedidos"
          className="text-stone-600 underline underline-offset-4 hover:text-ink"
        >
          Abrir panel de pedidos de prueba
        </Link>
      </div>
    </section>
  )
}
