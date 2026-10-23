import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useOrders } from '@/app/providers/orderContext'
import { buttonClassName } from '@/components/ui/button'
import { WhatsAppActions } from '@/components/ui/WhatsAppActions'
import {
  DELIVERY_METHOD_LABELS,
  FULFILLMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/domain/labels'
import { findOrderByCode } from '@/domain/order'
import { convertUsdCentsToVesCents, formatMoney, formatVesCents } from '@/domain/money'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  lookupRemoteOrder,
  submitRemotePaymentReference,
} from '@/data/repositories/remoteOrderGateway'
import { buildOrderMessage } from '@/lib/whatsapp'
import type { Order } from '@/domain/types'

export function OrderTrackingPage() {
  useDocumentTitle('Consulta de pedido · Norte Moda')
  const { orders, save } = useOrders()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const code = params.get('codigo') ?? ''
  const trackingToken = new URLSearchParams(location.hash.slice(1)).get('token') ?? ''
  const isRemoteLookup = trackingToken.length > 0
  const [input, setInput] = useState(code)
  const [copied, setCopied] = useState(false)
  const [manualSummary, setManualSummary] = useState('')
  const [remoteLookup, setRemoteLookup] = useState<{
    readonly key: string
    readonly order: Order
  } | null>(null)
  const [remoteFailure, setRemoteFailure] = useState<{
    readonly key: string
    readonly message: string
  } | null>(null)
  const [reference, setReference] = useState('')
  const [referenceNote, setReferenceNote] = useState('')
  const [referenceSubmitting, setReferenceSubmitting] = useState(false)
  const [referenceMessage, setReferenceMessage] = useState('')
  const [referenceError, setReferenceError] = useState('')
  const remoteLookupKey = `${code.toUpperCase()}|${trackingToken}`
  const remoteOrder = remoteLookup?.key === remoteLookupKey ? remoteLookup.order : null
  const remoteError = remoteFailure?.key === remoteLookupKey ? remoteFailure.message : ''
  const remoteLoading = isRemoteLookup && Boolean(code) && !remoteOrder && !remoteError
  const order = isRemoteLookup
    ? (remoteOrder ?? undefined)
    : code
      ? findOrderByCode(orders, code)
      : undefined
  const justCreated = params.get('creado') === '1'
  const orderWhatsAppMessage = order
    ? buildOrderMessage({
        code: order.code,
        customer: order.customer,
        items: order.items,
        paymentMethod: order.paymentMethod,
        deliveryMethod: order.deliveryMethod,
        shippingAgency: order.shippingAgency,
        totalCents: order.totalCents,
        note: order.customerNote,
      })
    : ''

  useEffect(() => {
    if (!isRemoteLookup || !code) return
    let current = true
    void lookupRemoteOrder(code, trackingToken)
      .then((foundOrder) => {
        if (current) setRemoteLookup({ key: remoteLookupKey, order: foundOrder })
      })
      .catch((caught: unknown) => {
        if (current) {
          setRemoteFailure({
            key: remoteLookupKey,
            message:
              caught instanceof Error
                ? caught.message
                : 'No se pudo consultar el pedido en el servidor.',
          })
        }
      })
    return () => {
      current = false
    }
  }, [code, isRemoteLookup, trackingToken, remoteLookupKey])

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
      `Estado del pedido: ${ORDER_STATUS_LABELS[order.orderStatus]}`,
      `Total: ${formatMoney(order.totalCents)}`,
      ...(order.exchangeQuote
        ? [
            `Total referencial: ${formatVesCents(convertUsdCentsToVesCents(order.totalCents, order.exchangeQuote.vesPerUsd))}`,
          ]
        : []),
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

  async function registerPaymentReference(): Promise<void> {
    if (!order) return
    const normalized = reference.trim()
    setReferenceError('')
    setReferenceMessage('')
    if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{3,79}$/.test(normalized)) {
      setReferenceError('Escribe la referencia de la operación (4 a 80 caracteres).')
      return
    }
    setReferenceSubmitting(true)
    try {
      if (isRemoteLookup) {
        await submitRemotePaymentReference({
          code: order.code,
          trackingToken,
          reference: normalized,
          note: referenceNote.trim(),
        })
        const refreshed = await lookupRemoteOrder(code, trackingToken)
        setRemoteLookup({ key: remoteLookupKey, order: refreshed })
        setReferenceMessage(
          'Referencia registrada. El pago sigue pendiente hasta que una persona autorizada lo verifique.',
        )
      } else {
        const event: Order['history'][number] = {
          axis: 'payment',
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          from: order.paymentStatus,
          to: 'por_verificar',
          note: 'Referencia informada por el comprador. Pendiente de verificación manual.',
        }
        const updated: Order = {
          ...order,
          paymentReference: normalized,
          paymentStatus: 'por_verificar',
          history: [...order.history, event],
        }
        if (!save(updated)) throw new Error('No se pudo guardar la referencia en este navegador.')
        setReferenceMessage(
          'Referencia guardada en este navegador. El pago sigue pendiente: es una demostración y no se verificó dinero.',
        )
      }
      setReference('')
      setReferenceNote('')
    } catch (caught) {
      setReferenceError(
        caught instanceof Error ? caught.message : 'No se pudo registrar la referencia.',
      )
    } finally {
      setReferenceSubmitting(false)
    }
  }

  async function refreshOrder(): Promise<void> {
    if (!isRemoteLookup || !code) return
    setReferenceError('')
    try {
      const refreshed = await lookupRemoteOrder(code, trackingToken)
      setRemoteLookup({ key: remoteLookupKey, order: refreshed })
    } catch (caught) {
      setReferenceError(
        caught instanceof Error ? caught.message : 'No se pudo actualizar el pedido.',
      )
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
        {isRemoteLookup
          ? 'Este enlace privado consulta el pedido y sus estados actuales en el servidor.'
          : 'Escribe el código que aparece en la confirmación. Los pedidos locales de demostración solo se consultan desde el navegador donde fueron creados.'}
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

      {remoteLoading ? (
        <p role="status" className="mt-7 rounded-2xl bg-white/70 p-5 text-sm text-stone-600">
          Consultando el pedido en el servidor…
        </p>
      ) : null}

      {isRemoteLookup && remoteError ? (
        <div role="alert" className="mt-7 rounded-2xl bg-red-50 p-5 text-sm text-red-900">
          {remoteError}
        </div>
      ) : null}

      {code && !order && !remoteLoading && !remoteError ? (
        <div role="status" className="mt-7 rounded-2xl bg-white/70 p-5 ring-1 ring-stone-900/10">
          <h2 className="font-medium">
            {isRemoteLookup
              ? 'No encontramos ese pedido'
              : 'No encontramos ese pedido en este navegador'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            {isRemoteLookup
              ? 'Revisa el código y abre el enlace privado completo que recibiste al crear el pedido.'
              : 'Revisa el código. Si se creó en otro navegador, consulta el enlace privado del pedido.'}
          </p>
        </div>
      ) : null}

      {order ? (
        <article className="mt-8 rounded-3xl bg-white/70 p-5 ring-1 ring-stone-900/10 sm:p-8">
          {justCreated ? (
            <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">
              {isRemoteLookup
                ? 'Pedido guardado en el servidor. Conserva este enlace privado para consultarlo desde tus dispositivos.'
                : 'Pedido guardado en este navegador. Guarda el código para volver a consultarlo en esta misma demo.'}
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
            <div className="flex flex-wrap gap-2">
              {isRemoteLookup ? (
                <button
                  type="button"
                  onClick={() => void refreshOrder()}
                  className={buttonClassName('secondary')}
                >
                  Actualizar estado
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void copySummary()}
                className={buttonClassName('secondary')}
              >
                {copied ? 'Resumen copiado' : 'Copiar resumen'}
              </button>
            </div>
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
            <div className="rounded-2xl bg-paper p-4 sm:col-span-2">
              <p className="text-xs text-stone-500">Estado del pedido</p>
              <p className="mt-1 font-medium">{ORDER_STATUS_LABELS[order.orderStatus]}</p>
            </div>
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
            {order.exchangeQuote ? (
              <p className="flex justify-between text-sm text-stone-600">
                <span>
                  Total en bolívares ·{' '}
                  {order.exchangeQuote.source === 'demo_ficticia' ? 'tasa ficticia' : 'BCV'}
                </span>
                <span>
                  {formatVesCents(
                    convertUsdCentsToVesCents(order.totalCents, order.exchangeQuote.vesPerUsd),
                  )}
                </span>
              </p>
            ) : null}
            <p className="pt-2 text-xs text-stone-500">
              Pago previsto: {PAYMENT_METHOD_LABELS[order.paymentMethod]}
            </p>
            {order.paymentInstructions ? (
              <div className="mt-3 rounded-xl bg-paper p-3 text-sm leading-relaxed text-stone-700">
                <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                  Instrucciones guardadas con el pedido
                </p>
                <p className="mt-1 whitespace-pre-wrap">{order.paymentInstructions}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-7 rounded-2xl bg-paper p-4">
            <h3 className="font-medium">Referencia del pago</h3>
            {order.paymentReference ? (
              <p className="mt-2 text-sm text-stone-700">
                Referencia informada: <strong>{order.paymentReference}</strong>
              </p>
            ) : (
              <p className="mt-2 text-sm text-stone-600">Todavía no registraste una referencia.</p>
            )}
            {['pendiente', 'por_verificar', 'rechazado'].includes(order.paymentStatus) ? (
              <form
                className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault()
                  void registerPaymentReference()
                }}
              >
                <label className="text-xs font-medium text-stone-600">
                  Número de referencia
                  <input
                    value={reference}
                    onChange={(event) => {
                      setReference(event.currentTarget.value)
                    }}
                    maxLength={80}
                    autoComplete="off"
                    placeholder="Ej. 123456789"
                    className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm text-ink ring-1 ring-stone-900/12 focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:outline-none"
                  />
                </label>
                <label className="text-xs font-medium text-stone-600">
                  Nota para revisión (opcional)
                  <input
                    value={referenceNote}
                    onChange={(event) => {
                      setReferenceNote(event.currentTarget.value)
                    }}
                    maxLength={300}
                    autoComplete="off"
                    placeholder="Banco, fecha u otro dato útil"
                    className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm text-ink ring-1 ring-stone-900/12 focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={referenceSubmitting}
                  className={buttonClassName('primary', 'min-h-11 disabled:opacity-60')}
                >
                  {referenceSubmitting ? 'Registrando…' : 'Enviar a revisión'}
                </button>
              </form>
            ) : null}
            <p className="mt-3 text-xs leading-relaxed text-stone-500">
              Enviar una referencia no aprueba el pago ni demuestra que el dinero haya llegado. Una
              persona autorizada debe verificarlo antes de preparar el pedido.
            </p>
            {referenceMessage ? (
              <p role="status" className="mt-3 text-sm text-emerald-800">
                {referenceMessage}
              </p>
            ) : null}
            {referenceError ? (
              <p role="alert" className="mt-3 text-sm text-red-800">
                {referenceError}
              </p>
            ) : null}
          </div>

          <div className="mt-7 border-t border-stone-900/10 pt-5">
            <h3 className="font-medium">Historial</h3>
            <ol className="mt-3 space-y-3">
              {order.history.map((event) => (
                <li key={event.id} className="border-l border-stone-900/15 pl-3 text-sm">
                  <p>
                    {event.axis === 'payment'
                      ? `Pago: ${PAYMENT_STATUS_LABELS[event.to]}`
                      : event.axis === 'fulfillment'
                        ? `Preparación y entrega: ${FULFILLMENT_STATUS_LABELS[event.to]}`
                        : `Pedido: ${ORDER_STATUS_LABELS[event.to]}`}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {new Date(event.at).toLocaleString('es-VE')}
                    {event.note ? ` · ${event.note}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {justCreated ? (
            <section className="mt-7 border-t border-stone-900/10 pt-5">
              <h3 className="font-medium">Continúa por WhatsApp</h3>
              <p className="mb-4 mt-2 text-sm leading-relaxed text-stone-600">
                Revisa el resumen del pedido y envíalo a la tienda para coordinar la compra. El pago
                y la entrega se confirman manualmente.
              </p>
              <WhatsAppActions
                message={orderWhatsAppMessage}
                label="Abrir WhatsApp con mi pedido"
                variant="primary"
              />
            </section>
          ) : null}
        </article>
      ) : null}

      <div className="mt-7 flex flex-wrap gap-5 text-sm">
        <Link to="/catalogo" className="text-stone-600 underline underline-offset-4 hover:text-ink">
          Volver al catálogo
        </Link>
      </div>
    </section>
  )
}
