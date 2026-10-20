import { useMemo, useState } from 'react'

import { useOrders } from '@/app/providers/orderContext'
import { buttonClassName } from '@/components/ui/button'
import {
  FULFILLMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/domain/labels'
import {
  getAllowedFulfillmentTransitions,
  getAllowedPaymentTransitions,
  transitionFulfillmentStatus,
  transitionPaymentStatus,
} from '@/domain/order'
import { formatMoney } from '@/domain/money'
import type { FulfillmentStatus, PaymentStatus } from '@/domain/types'

export function OrderAdmin() {
  const { orders, save } = useOrders()
  const [query, setQuery] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [fulfillmentFilter, setFulfillmentFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(orders[0]?.id ?? null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesQuery =
        normalized === '' ||
        order.code.toLowerCase().includes(normalized) ||
        `${order.customer.firstName} ${order.customer.lastName}`.toLowerCase().includes(normalized)
      return (
        matchesQuery &&
        (!paymentFilter || order.paymentStatus === paymentFilter) &&
        (!fulfillmentFilter || order.fulfillmentStatus === fulfillmentFilter)
      )
    })
  }, [orders, query, paymentFilter, fulfillmentFilter])
  const selected = orders.find((order) => order.id === selectedId)

  function updatePayment(next: PaymentStatus): void {
    if (!selected) return
    setError('')
    setNotice('')
    try {
      const note =
        next === 'por_verificar'
          ? 'Comprobante recibido; pendiente de revisión manual.'
          : next === 'pagado'
            ? 'Pago verificado manualmente por el administrador de la demo.'
            : next === 'rechazado'
              ? 'Pago no verificado; el pedido requiere coordinación.'
              : 'Estado actualizado por el administrador de la demo.'
      const nextOrder = transitionPaymentStatus(selected, next, note)
      if (!save(nextOrder)) throw new Error('No se pudo guardar el cambio en este navegador.')
      setNotice('Estado de pago guardado.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo actualizar el pago.')
    }
  }

  function updateFulfillment(next: FulfillmentStatus): void {
    if (!selected) return
    setError('')
    setNotice('')
    try {
      const nextOrder = transitionFulfillmentStatus(
        selected,
        next,
        `Entrega actualizada manualmente a: ${FULFILLMENT_STATUS_LABELS[next]}.`,
      )
      if (!save(nextOrder)) throw new Error('No se pudo guardar el cambio en este navegador.')
      setNotice('Estado de preparación o entrega guardado.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo actualizar la entrega.')
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(18rem,0.75fr)_1.25fr]">
      <section>
        <h2 className="text-xl font-medium">Pedidos ({orders.length})</h2>
        <label className="mt-4 block text-xs font-medium text-stone-600">
          Buscar pedido o comprador
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value)
            }}
            placeholder="NM-0001 o Ana Pérez"
            className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm ring-1 ring-stone-900/12"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <select
            aria-label="Filtrar por pago"
            value={paymentFilter}
            onChange={(event) => {
              setPaymentFilter(event.currentTarget.value)
            }}
            className="min-h-10 rounded-xl bg-white px-3 text-xs ring-1 ring-stone-900/12"
          >
            <option value="">Todos los pagos</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por entrega"
            value={fulfillmentFilter}
            onChange={(event) => {
              setFulfillmentFilter(event.currentTarget.value)
            }}
            className="min-h-10 rounded-xl bg-white px-3 text-xs ring-1 ring-stone-900/12"
          >
            <option value="">Todas las entregas</option>
            {Object.entries(FULFILLMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {filtered.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-white/60 p-5 text-sm text-stone-500">
            {orders.length === 0
              ? 'Todavía no hay pedidos. Completa el checkout de prueba para crear uno.'
              : 'No hay pedidos que coincidan con esos filtros.'}
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-stone-900/10 rounded-2xl border border-stone-900/10 bg-white/50">
            {filtered.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(order.id)
                  }}
                  aria-pressed={selectedId === order.id}
                  className={`w-full p-4 text-left transition-colors hover:bg-white/80 ${selectedId === order.id ? 'bg-white/80' : ''}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <strong>{order.code}</strong>
                    <span className="text-sm tabular-nums">{formatMoney(order.totalCents)}</span>
                  </span>
                  <span className="mt-1 block text-xs text-stone-500">
                    {order.customer.firstName} {order.customer.lastName} ·{' '}
                    {new Date(order.createdAt).toLocaleDateString('es-VE')}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-stone-100 px-2.5 py-1">
                      Pago: {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1">
                      Entrega: {FULFILLMENT_STATUS_LABELS[order.fulfillmentStatus]}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        {selected ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs tracking-[0.15em] text-stone-500 uppercase">
                  Detalle del pedido
                </p>
                <h2 className="mt-1 text-2xl font-medium">{selected.code}</h2>
              </div>
              <p className="text-xs text-stone-500">
                Creado {new Date(selected.createdAt).toLocaleString('es-VE')}
              </p>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-stone-900/8">
                <h3 className="text-sm font-medium">Comprador</h3>
                <p className="mt-2 text-sm">
                  {selected.customer.firstName} {selected.customer.lastName}
                </p>
                <p className="mt-1 text-sm text-stone-600">{selected.customer.phone}</p>
              </div>
              <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-stone-900/8">
                <h3 className="text-sm font-medium">Coordinación</h3>
                <p className="mt-2 text-sm">{PAYMENT_METHOD_LABELS[selected.paymentMethod]}</p>
                <p className="mt-1 text-sm text-stone-600">
                  {selected.deliveryMethod === 'envio_nacional' && selected.shippingAgency
                    ? `${selected.shippingAgency} · `
                    : ''}
                  {selected.shippingAddress?.city ?? 'Retiro en tienda'}
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-white/60 p-4 ring-1 ring-stone-900/8">
              <h3 className="text-sm font-medium">Artículos</h3>
              <ul className="mt-3 divide-y divide-stone-900/8">
                {selected.items.map((item, index) => (
                  <li
                    key={`${item.variantId}-${String(index)}`}
                    className="flex justify-between gap-4 py-3 text-sm"
                  >
                    <span>
                      {item.quantity} × {item.productName}
                      <span className="block text-xs text-stone-500">
                        Talla {item.size} · {item.color}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatMoney(item.unitPriceCents * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-1 border-t border-stone-900/10 pt-3 text-sm">
                <p className="flex justify-between">
                  <span>Prendas</span>
                  <span>{formatMoney(selected.subtotalCents)}</span>
                </p>
                <p className="flex justify-between">
                  <span>Entrega</span>
                  <span>{formatMoney(selected.shippingCents)}</span>
                </p>
                <p className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{formatMoney(selected.totalCents)}</span>
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-stone-900/8">
                <h3 className="text-sm font-medium">
                  Pago · {PAYMENT_STATUS_LABELS[selected.paymentStatus]}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-stone-600">
                  Marcar «por verificar» solo registra que el comprobante se recibió. Confirma el
                  pago únicamente después de revisarlo por el canal correspondiente; esta demo no
                  consulta bancos.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {getAllowedPaymentTransitions(selected.paymentStatus).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        updatePayment(status)
                      }}
                      className="rounded-full bg-white px-3 py-2 text-xs ring-1 ring-stone-900/15 hover:bg-stone-50"
                    >
                      {status === 'por_verificar'
                        ? 'Pasar a verificación'
                        : status === 'pagado'
                          ? 'Confirmar pago revisado'
                          : PAYMENT_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-stone-900/8">
                <h3 className="text-sm font-medium">
                  Entrega · {FULFILLMENT_STATUS_LABELS[selected.fulfillmentStatus]}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-stone-600">
                  La preparación y el despacho se registran manualmente en esta demostración; no se
                  conecta con una agencia.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {getAllowedFulfillmentTransitions(selected.fulfillmentStatus).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        updateFulfillment(status)
                      }}
                      className="rounded-full bg-white px-3 py-2 text-xs ring-1 ring-stone-900/15 hover:bg-stone-50"
                    >
                      {FULFILLMENT_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {error ? (
              <p role="alert" className="mt-4 text-sm text-red-800">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p aria-live="polite" className="mt-4 text-sm text-emerald-800">
                {notice}
              </p>
            ) : null}

            <div className="mt-6 rounded-2xl border border-stone-900/10 p-4">
              <h3 className="text-sm font-medium">Historial</h3>
              <ol className="mt-3 space-y-3">
                {selected.history.map((event) => (
                  <li key={event.id} className="border-l border-stone-900/15 pl-3 text-xs">
                    <p className="font-medium">
                      {event.axis === 'payment' ? 'Pago' : 'Preparación y entrega'}:{' '}
                      {event.from ?? 'Creado'} → {event.to}
                    </p>
                    <p className="mt-1 text-stone-500">
                      {new Date(event.at).toLocaleString('es-VE')}
                      {event.note ? ` · ${event.note}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
            <a
              href={`/pedido?codigo=${encodeURIComponent(selected.code)}`}
              className={buttonClassName('secondary', 'mt-5')}
            >
              Ver seguimiento del pedido
            </a>
          </>
        ) : (
          <div className="rounded-2xl bg-white/60 p-6 text-sm text-stone-500">
            Selecciona un pedido para consultar sus datos y gestionar sus estados.
          </div>
        )}
      </section>
    </div>
  )
}
