import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import type { SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useCatalog } from '@/app/providers/catalogContext'
import { useCart } from '@/app/providers/cartContext'
import { useOrders } from '@/app/providers/orderContext'
import { buttonClassName } from '@/components/ui/button'
import { DELIVERY_METHOD_LABELS } from '@/domain/labels'
import { createOrderItems } from '@/domain/order'
import { createDemoExchangeQuote } from '@/domain/exchangeRate'
import { summarizeCart } from '@/domain/cart'
import { convertUsdCentsToVesCents, formatMoney, formatVesCents } from '@/domain/money'
import { getShippingCents } from '@/domain/shipping'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import {
  createRemoteOrder,
  createRemoteOrderCredentials,
  requestRemoteCheckoutQuote,
  requestRemotePaymentOptions,
} from '@/data/repositories/remoteOrderGateway'
import type { RemoteStorePaymentOption } from '@/data/repositories/remoteOrderGateway'
import {
  clearDirectCheckoutIntent,
  getOrCreateDirectCheckoutCredentials,
  readDirectCheckoutIntent,
  resolveDirectCheckoutSelection,
} from './directCheckout'

const checkoutSchema = z
  .object({
    firstName: z.string().trim().min(2, 'Escribe tu nombre.'),
    lastName: z.string().trim().min(2, 'Escribe tu apellido.'),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s()-]{8,20}$/, 'Escribe un teléfono de contacto válido.'),
    deliveryMethod: z.enum(['delivery_local', 'envio_nacional', 'retiro']),
    state: z.string().trim(),
    city: z.string().trim(),
    addressLine: z.string().trim(),
    reference: z.string().trim(),
    shippingAgency: z.string().trim(),
    paymentMethod: z.enum([
      'pago_movil',
      'transferencia',
      'efectivo',
      'efectivo_ves',
      'efectivo_usd',
    ]),
    customerNote: z.string().trim().max(300, 'La nota puede tener hasta 300 caracteres.'),
    whatsappOptIn: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.whatsappOptIn && !/^[1-9][0-9]{7,14}$/.test(value.phone.replace(/\D/g, ''))) {
      context.addIssue({
        code: 'custom',
        path: ['phone'],
        message:
          'Para el seguimiento por WhatsApp, incluye el código internacional, por ejemplo +58.',
      })
    }
    if (value.deliveryMethod === 'delivery_local') {
      if (value.city.length < 2)
        context.addIssue({ code: 'custom', path: ['city'], message: 'Indica la ciudad.' })
      if (value.addressLine.length < 5)
        context.addIssue({
          code: 'custom',
          path: ['addressLine'],
          message: 'Escribe una dirección para coordinar el delivery.',
        })
    }
    if (value.deliveryMethod === 'envio_nacional') {
      if (value.state.length < 2)
        context.addIssue({ code: 'custom', path: ['state'], message: 'Indica el estado.' })
      if (value.city.length < 2)
        context.addIssue({ code: 'custom', path: ['city'], message: 'Indica la ciudad.' })
      if (value.shippingAgency.length < 2)
        context.addIssue({
          code: 'custom',
          path: ['shippingAgency'],
          message: 'Indica la agencia de preferencia.',
        })
    }
  })

type CheckoutFormValues = z.infer<typeof checkoutSchema>

const INPUT_CLASS =
  'mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm text-ink ring-1 ring-stone-900/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30'

export function CheckoutPage() {
  useDocumentTitle('Checkout · Norte Moda')
  const { catalog, catalogMode, refreshCatalog } = useCatalog()
  const { lines, isReady: cartReady, clear } = useCart()
  const { create } = useOrders()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const directToken = searchParams.get('compra')
  const hasDirectCheckout = searchParams.has('compra')
  const directIntent = directToken ? readDirectCheckoutIntent(directToken) : null
  const directSelection = directIntent
    ? resolveDirectCheckoutSelection(catalog, directIntent.variantId, directIntent.quantity)
    : null
  const directCheckoutError = hasDirectCheckout
    ? directIntent === null
      ? 'No se pudo recuperar esta compra directa. El carrito que ya tenías se conservó.'
      : directSelection?.status === 'unavailable'
        ? `${directSelection.message} El carrito que ya tenías se conservó.`
        : ''
    : ''
  const checkoutLines = hasDirectCheckout
    ? directSelection?.status === 'ready'
      ? [directSelection.line]
      : []
    : lines
  const usesRemoteBackend = getSupabaseBrowserClient() !== null
  const [paymentOptions, setPaymentOptions] = useState<readonly RemoteStorePaymentOption[]>([])
  const [paymentOptionsLoading, setPaymentOptionsLoading] = useState(usesRemoteBackend)
  const [paymentOptionsError, setPaymentOptionsError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [exchangeQuote, setExchangeQuote] = useState(() => createDemoExchangeQuote())
  const [remoteQuoteResult, setRemoteQuoteResult] = useState<{
    readonly fingerprint: string
    readonly quote: Awaited<ReturnType<typeof requestRemoteCheckoutQuote>>
  } | null>(null)
  const [remoteQuoteFailure, setRemoteQuoteFailure] = useState<{
    readonly fingerprint: string
    readonly message: string
  } | null>(null)
  const [quoteConfirmationPending, setQuoteConfirmationPending] = useState(false)
  const [remoteCredentials, setRemoteCredentials] = useState<{
    readonly fingerprint: string
    readonly idempotencyKey: string
    readonly trackingToken: string
  } | null>(null)
  const checkoutFingerprint = JSON.stringify(
    checkoutLines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
  )
  useEffect(() => {
    if (usesRemoteBackend) return
    const refreshDelay = Math.max(0, Date.parse(exchangeQuote.expiresAt) - Date.now())
    const timer = window.setTimeout(() => {
      setExchangeQuote(createDemoExchangeQuote())
    }, refreshDelay)
    return () => {
      window.clearTimeout(timer)
    }
  }, [exchangeQuote.expiresAt, usesRemoteBackend])
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      deliveryMethod: 'delivery_local',
      state: '',
      city: '',
      addressLine: '',
      reference: '',
      shippingAgency: '',
      paymentMethod: usesRemoteBackend ? 'pago_movil' : 'efectivo',
      customerNote: '',
      whatsappOptIn: false,
    },
  })
  const deliveryMethod = useWatch({ control, name: 'deliveryMethod' })
  const selectedPaymentMethod = useWatch({ control, name: 'paymentMethod' })
  const selectedPaymentOption = paymentOptions.find(
    (option) => option.method === selectedPaymentMethod,
  )

  useEffect(() => {
    if (!usesRemoteBackend) return
    let current = true
    void requestRemotePaymentOptions()
      .then((options) => {
        if (!current) return
        setPaymentOptions(options)
        setPaymentOptionsError('')
      })
      .catch((caught: unknown) => {
        if (current) {
          setPaymentOptions([])
          setPaymentOptionsError(
            caught instanceof Error ? caught.message : 'No se pudieron cargar los métodos de pago.',
          )
        }
      })
      .finally(() => {
        if (current) setPaymentOptionsLoading(false)
      })
    return () => {
      current = false
    }
  }, [usesRemoteBackend])

  useEffect(() => {
    if (
      paymentOptions.length > 0 &&
      !paymentOptions.some((option) => option.method === selectedPaymentMethod)
    ) {
      setValue('paymentMethod', paymentOptions[0]?.method ?? 'pago_movil')
    }
  }, [paymentOptions, selectedPaymentMethod, setValue])
  const quoteRequestFingerprint = `${directToken ?? 'cart'}|${checkoutFingerprint}|${deliveryMethod}`
  const summary = summarizeCart(checkoutLines, catalog)
  const shippingCents = getShippingCents(deliveryMethod)
  const totalCents = summary.subtotalCents + shippingCents
  const totalVesCents = convertUsdCentsToVesCents(totalCents, exchangeQuote.vesPerUsd)
  const remoteQuote =
    remoteQuoteResult?.fingerprint === quoteRequestFingerprint ? remoteQuoteResult.quote : null
  const remoteQuoteError =
    remoteQuoteFailure?.fingerprint === quoteRequestFingerprint ? remoteQuoteFailure.message : ''
  const remoteQuoteLoading =
    usesRemoteBackend && summary.canCheckout && !remoteQuote && !remoteQuoteError
  useEffect(() => {
    if (!usesRemoteBackend || !summary.canCheckout) return
    let current = true
    const items = JSON.parse(checkoutFingerprint) as readonly {
      readonly variantId: string
      readonly quantity: number
    }[]
    void requestRemoteCheckoutQuote({ items, deliveryMethod })
      .then((quote) => {
        if (!current) return
        setRemoteQuoteResult({ fingerprint: quoteRequestFingerprint, quote })
        setQuoteConfirmationPending(
          quote.subtotalCents !== summary.subtotalCents ||
            quote.shippingCents !== shippingCents ||
            quote.vesPerUsd !== exchangeQuote.vesPerUsd ||
            quote.source !== exchangeQuote.source,
        )
      })
      .catch((caught: unknown) => {
        if (current) {
          setRemoteQuoteFailure({
            fingerprint: quoteRequestFingerprint,
            message:
              caught instanceof Error
                ? caught.message
                : 'El servidor no pudo validar el carrito. Inténtalo de nuevo.',
          })
        }
      })
    return () => {
      current = false
    }
  }, [
    usesRemoteBackend,
    quoteRequestFingerprint,
    checkoutFingerprint,
    deliveryMethod,
    summary.canCheckout,
    summary.subtotalCents,
    shippingCents,
    exchangeQuote.vesPerUsd,
    exchangeQuote.source,
  ])

  const shownSubtotalCents = remoteQuote?.subtotalCents ?? summary.subtotalCents
  const shownShippingCents = remoteQuote?.shippingCents ?? shippingCents
  const shownTotalCents = remoteQuote?.totalCents ?? totalCents
  const shownVesTotalCents = remoteQuote?.vesTotalCents ?? totalVesCents
  const shownRate = remoteQuote?.vesPerUsd ?? exchangeQuote.vesPerUsd
  const quoteSourceLabel = remoteQuote?.source === 'bcv' ? 'BCV' : 'tasa ficticia de demo'

  const onSubmit: SubmitHandler<CheckoutFormValues> = async (values) => {
    setSubmitError('')
    const latestSummary = checkoutLines.length ? summarizeCart(checkoutLines, catalog) : null
    if (!latestSummary?.canCheckout) {
      setSubmitError(
        hasDirectCheckout
          ? 'La variante o la cantidad ya no están disponibles. Vuelve al producto para revisar la selección; tu carrito sigue intacto.'
          : 'El carrito cambió o ya no tiene artículos disponibles. Vuelve al carrito y revisa las variantes.',
      )
      return
    }

    if (usesRemoteBackend) {
      if (!remoteQuote) {
        setSubmitError(
          remoteQuoteError ||
            'Espera a que el servidor valide precios y existencias antes de crear el pedido.',
        )
        return
      }
      const items = JSON.parse(checkoutFingerprint) as readonly {
        readonly variantId: string
        readonly quantity: number
      }[]
      let currentQuote: Awaited<ReturnType<typeof requestRemoteCheckoutQuote>>
      try {
        currentQuote = await requestRemoteCheckoutQuote({
          items,
          deliveryMethod: values.deliveryMethod,
        })
      } catch (caught) {
        setSubmitError(
          caught instanceof Error
            ? caught.message
            : 'No se pudo renovar la cotización. El pedido no se creó.',
        )
        return
      }
      const quoteChanged =
        currentQuote.subtotalCents !== remoteQuote.subtotalCents ||
        currentQuote.shippingCents !== remoteQuote.shippingCents ||
        currentQuote.totalCents !== remoteQuote.totalCents ||
        currentQuote.vesTotalCents !== remoteQuote.vesTotalCents ||
        currentQuote.vesPerUsd !== remoteQuote.vesPerUsd ||
        currentQuote.source !== remoteQuote.source
      if (quoteChanged) {
        setRemoteQuoteResult({ fingerprint: quoteRequestFingerprint, quote: currentQuote })
        setQuoteConfirmationPending(true)
        setSubmitError(
          'El precio, la entrega o la tasa cambió. Revisa el nuevo importe y confirma para continuar.',
        )
        return
      }

      const credentials = directToken
        ? getOrCreateDirectCheckoutCredentials(directToken, createRemoteOrderCredentials)
        : remoteCredentials?.fingerprint === checkoutFingerprint
          ? remoteCredentials
          : { fingerprint: checkoutFingerprint, ...createRemoteOrderCredentials() }
      if (credentials === null) {
        setSubmitError(
          'No se pudo conservar la compra para reintentar con seguridad. Vuelve al producto para iniciarla de nuevo; tu carrito sigue intacto.',
        )
        return
      }
      if (!directToken) {
        setRemoteCredentials({
          fingerprint: checkoutFingerprint,
          idempotencyKey: credentials.idempotencyKey,
          trackingToken: credentials.trackingToken,
        })
      }
      const customer = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: values.phone.trim(),
        email: null,
      }
      const shippingAddress =
        values.deliveryMethod === 'retiro'
          ? null
          : {
              state: values.state.trim(),
              city: values.city.trim(),
              addressLine: values.addressLine.trim(),
              reference: values.reference.trim(),
            }
      try {
        const result = await createRemoteOrder({
          idempotencyKey: credentials.idempotencyKey,
          trackingToken: credentials.trackingToken,
          quoteId: currentQuote.id,
          expectedSubtotalCents: currentQuote.subtotalCents,
          expectedShippingCents: currentQuote.shippingCents,
          expectedTotalCents: currentQuote.totalCents,
          expectedVesTotalCents: currentQuote.vesTotalCents,
          customer,
          deliveryMethod: values.deliveryMethod,
          shippingAddress,
          shippingAgency:
            values.deliveryMethod === 'envio_nacional' ? values.shippingAgency.trim() : null,
          paymentMethod: values.paymentMethod,
          customerNote: values.customerNote.trim() || null,
          whatsappOptIn: values.whatsappOptIn,
          items,
        })
        if (directToken) clearDirectCheckoutIntent(directToken)
        else clear()
        void navigate(
          `/pedido?codigo=${encodeURIComponent(result.order.code)}&creado=1#token=${result.trackingToken}`,
        )
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : 'No se pudo guardar el pedido remoto.'
        if (message.includes('cotización cambió')) {
          try {
            const refreshed = await requestRemoteCheckoutQuote({
              items,
              deliveryMethod: values.deliveryMethod,
            })
            setRemoteQuoteResult({ fingerprint: quoteRequestFingerprint, quote: refreshed })
            setQuoteConfirmationPending(true)
          } catch {
            // Preserve the latest server response so the buyer can retry safely.
          }
        }
        setSubmitError(message)
      }
      return
    }

    const customer = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim(),
      email: null,
    }
    const shippingAddress =
      values.deliveryMethod === 'retiro'
        ? null
        : {
            state: values.state.trim(),
            city: values.city.trim(),
            addressLine: values.addressLine.trim(),
            reference: values.reference.trim(),
          }

    const order = create({
      customer,
      deliveryMethod: values.deliveryMethod,
      shippingAddress,
      shippingAgency:
        values.deliveryMethod === 'envio_nacional' ? values.shippingAgency.trim() : null,
      paymentMethod: values.paymentMethod,
      paymentInstructions: null,
      paymentReference: null,
      customerNote: values.customerNote.trim() || null,
      items: createOrderItems(latestSummary.details),
      shippingCents,
      exchangeQuote,
    })

    if (order === null) {
      setSubmitError(
        'No pudimos guardar el pedido en este navegador. No se creó una confirmación; inténtalo de nuevo.',
      )
      return
    }

    if (directToken) clearDirectCheckoutIntent(directToken)
    else clear()
    void navigate(`/pedido?codigo=${encodeURIComponent(order.code)}&creado=1`)
  }

  function fieldError(name: keyof CheckoutFormValues): string | undefined {
    return errors[name]?.message
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
        {usesRemoteBackend ? 'Checkout del servidor' : 'Pedido de demostración'}
      </p>
      <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em] sm:text-5xl">Checkout</h1>

      {!cartReady ? (
        catalogMode === 'error' ? (
          <div role="alert" className="mt-8 rounded-2xl bg-amber-50 p-6 text-sm text-amber-950">
            <p>No se pudo validar tu selección con el catálogo remoto. No se creará un pedido.</p>
            <button
              type="button"
              onClick={() => void refreshCatalog()}
              className="mt-4 underline underline-offset-4"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <p role="status" className="mt-8 rounded-2xl bg-white/65 p-6 text-sm text-stone-600">
            Esperando a que el catálogo remoto valide las variantes del carrito…
          </p>
        )
      ) : hasDirectCheckout && directCheckoutError ? (
        <div
          role="alert"
          className="mt-8 rounded-2xl bg-amber-50 p-6 text-sm leading-relaxed text-amber-950 ring-1 ring-amber-900/10"
        >
          <p>{directCheckoutError}</p>
          <div className="mt-4 flex flex-wrap gap-4">
            {directSelection && 'productSlug' in directSelection ? (
              <Link
                to={`/producto/${directSelection.productSlug}`}
                className="font-medium underline underline-offset-4"
              >
                Revisar producto
              </Link>
            ) : null}
            <Link to="/carrito" className="font-medium underline underline-offset-4">
              Ver carrito conservado
            </Link>
            <Link to="/catalogo" className="font-medium underline underline-offset-4">
              Explorar catálogo
            </Link>
          </div>
        </div>
      ) : checkoutLines.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white/65 p-6 ring-1 ring-stone-900/10">
          <p className="font-medium">No tienes artículos para confirmar.</p>
          <Link to="/catalogo" className={buttonClassName('primary', 'mt-5')}>
            Explorar catálogo
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            void handleSubmit(onSubmit)(event)
          }}
          noValidate
          className="mt-8 grid gap-8 lg:grid-cols-[1fr_21rem] lg:items-start"
        >
          {hasDirectCheckout ? (
            <p
              role="status"
              className="rounded-2xl bg-sky-50 p-4 text-sm leading-relaxed text-sky-950 ring-1 ring-sky-900/10 lg:col-span-2"
            >
              Compra directa: este pedido incluye solo la prenda y cantidad seleccionadas. Los
              artículos de tu carrito se conservan aparte.
            </p>
          ) : null}
          <div className="space-y-7">
            <section className="rounded-3xl bg-white/60 p-5 ring-1 ring-stone-900/10 sm:p-7">
              <h2 className="text-xl font-medium">Tus datos</h2>
              <p className="mt-2 text-xs text-stone-500">
                Usamos tu nombre y teléfono para identificar el pedido. No pedimos cédula ni datos
                bancarios.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-medium text-stone-600">
                  Nombre
                  <input
                    autoComplete="given-name"
                    {...register('firstName')}
                    className={INPUT_CLASS}
                  />
                  {fieldError('firstName') ? (
                    <span className="mt-1 block text-xs text-red-800">
                      {fieldError('firstName')}
                    </span>
                  ) : null}
                </label>
                <label className="text-xs font-medium text-stone-600">
                  Apellido
                  <input
                    autoComplete="family-name"
                    {...register('lastName')}
                    className={INPUT_CLASS}
                  />
                  {fieldError('lastName') ? (
                    <span className="mt-1 block text-xs text-red-800">
                      {fieldError('lastName')}
                    </span>
                  ) : null}
                </label>
                <label className="text-xs font-medium text-stone-600 sm:col-span-2">
                  Teléfono de contacto
                  <input
                    type="tel"
                    autoComplete="tel"
                    placeholder="+58 412 000 0000"
                    {...register('phone')}
                    className={INPUT_CLASS}
                  />
                  {fieldError('phone') ? (
                    <span className="mt-1 block text-xs text-red-800">{fieldError('phone')}</span>
                  ) : null}
                </label>
              </div>
            </section>

            <section className="rounded-3xl bg-white/60 p-5 ring-1 ring-stone-900/10 sm:p-7">
              <h2 className="text-xl font-medium">Entrega</h2>
              <label className="mt-4 block text-xs font-medium text-stone-600">
                Cómo coordinamos
                <select {...register('deliveryMethod')} className={INPUT_CLASS}>
                  {Object.entries(DELIVERY_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {deliveryMethod !== 'retiro' ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {deliveryMethod === 'envio_nacional' ? (
                    <label className="text-xs font-medium text-stone-600">
                      Estado
                      <input
                        autoComplete="address-level1"
                        {...register('state')}
                        className={INPUT_CLASS}
                      />
                      {fieldError('state') ? (
                        <span className="mt-1 block text-xs text-red-800">
                          {fieldError('state')}
                        </span>
                      ) : null}
                    </label>
                  ) : null}
                  <label className="text-xs font-medium text-stone-600">
                    Ciudad
                    <input
                      autoComplete="address-level2"
                      {...register('city')}
                      className={INPUT_CLASS}
                    />
                    {fieldError('city') ? (
                      <span className="mt-1 block text-xs text-red-800">{fieldError('city')}</span>
                    ) : null}
                  </label>
                  {deliveryMethod === 'envio_nacional' ? (
                    <label className="text-xs font-medium text-stone-600">
                      Agencia de preferencia
                      <input {...register('shippingAgency')} className={INPUT_CLASS} />
                      {fieldError('shippingAgency') ? (
                        <span className="mt-1 block text-xs text-red-800">
                          {fieldError('shippingAgency')}
                        </span>
                      ) : null}
                    </label>
                  ) : null}
                  {deliveryMethod === 'delivery_local' ? (
                    <label className="text-xs font-medium text-stone-600 sm:col-span-2">
                      Dirección
                      <input
                        autoComplete="street-address"
                        {...register('addressLine')}
                        className={INPUT_CLASS}
                      />
                      {fieldError('addressLine') ? (
                        <span className="mt-1 block text-xs text-red-800">
                          {fieldError('addressLine')}
                        </span>
                      ) : null}
                    </label>
                  ) : null}
                  <label className="text-xs font-medium text-stone-600 sm:col-span-2">
                    Referencia (opcional)
                    <input {...register('reference')} className={INPUT_CLASS} />
                  </label>
                </div>
              ) : (
                <p className="mt-3 text-sm text-stone-600">
                  Coordinaremos un retiro ficticio en tienda. No se procesa ningún envío.
                </p>
              )}
            </section>

            <section className="rounded-3xl bg-white/60 p-5 ring-1 ring-stone-900/10 sm:p-7">
              <h2 className="text-xl font-medium">Pago y nota</h2>
              {usesRemoteBackend ? (
                <>
                  <label className="mt-4 block text-xs font-medium text-stone-600">
                    Método previsto
                    {paymentOptions.length ? (
                      <select {...register('paymentMethod')} className={INPUT_CLASS}>
                        {paymentOptions.map((option) => (
                          <option key={option.method} value={option.method}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="mt-2 block rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                        {paymentOptionsLoading
                          ? 'Cargando métodos disponibles…'
                          : paymentOptionsError ||
                            'La tienda todavía no ha configurado métodos de pago.'}
                      </span>
                    )}
                  </label>
                  {selectedPaymentOption?.instructions ? (
                    <div className="mt-3 rounded-xl bg-paper p-3 text-sm leading-relaxed text-stone-700">
                      <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                        Instrucciones de pago
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {selectedPaymentOption.instructions}
                      </p>
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs leading-relaxed text-stone-500">
                    Seleccionar un método no realiza el pago. Un administrador autorizado verifica y
                    registra el pago manualmente.
                  </p>
                  <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-stone-700">
                    <input
                      type="checkbox"
                      {...register('whatsappOptIn')}
                      className="mt-1 size-4 shrink-0 accent-ink"
                    />
                    <span>
                      Acepto recibir mensajes de Norte Moda por WhatsApp para dar seguimiento a este
                      pedido. Puedo solicitar que no me contacten por ese medio. Este permiso no
                      incluye mensajes promocionales. Si aceptas, escribe tu teléfono con el código
                      internacional (por ejemplo, +58).
                    </span>
                  </label>
                </>
              ) : (
                <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
                  Esta demostración local no ofrece métodos de pago ni cobra dinero. Solo crea un
                  pedido ficticio en este navegador.
                </p>
              )}
              <label className="mt-4 block text-xs font-medium text-stone-600">
                Nota opcional
                <textarea
                  rows={3}
                  maxLength={300}
                  {...register('customerNote')}
                  className="mt-1.5 w-full rounded-xl bg-white p-3 text-sm ring-1 ring-stone-900/12"
                />
                {fieldError('customerNote') ? (
                  <span className="mt-1 block text-xs text-red-800">
                    {fieldError('customerNote')}
                  </span>
                ) : null}
              </label>
            </section>
          </div>

          <aside className="rounded-3xl bg-white/70 p-5 ring-1 ring-stone-900/10 sm:p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-medium">Resumen</h2>
            <ul className="mt-4 space-y-3 border-b border-stone-900/10 pb-4 text-sm">
              {remoteQuote
                ? remoteQuote.items.map((item) => (
                    <li key={item.variantId} className="flex justify-between gap-3">
                      <span>
                        {item.quantity} × {item.productName}
                        <span className="block text-xs text-stone-500">
                          {item.size} · {item.color} · SKU {item.sku}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatMoney(item.lineTotalCents)}
                      </span>
                    </li>
                  ))
                : summary.details.map((detail) => (
                    <li key={detail.variant.id} className="flex justify-between gap-3">
                      <span>
                        {detail.quantity} × {detail.product.name}
                        <span className="block text-xs text-stone-500">
                          {detail.variant.size} · {detail.variant.color}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatMoney(detail.lineTotalCents)}
                      </span>
                    </li>
                  ))}
            </ul>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-stone-600">
                <dt>Prendas</dt>
                <dd>{formatMoney(shownSubtotalCents)}</dd>
              </div>
              <div className="flex justify-between text-stone-600">
                <dt>Entrega</dt>
                <dd>{formatMoney(shownShippingCents)}</dd>
              </div>
              <div className="flex justify-between border-t border-stone-900/10 pt-3 text-base font-medium">
                <dt>Total</dt>
                <dd className="text-right">
                  <span className="block">{formatMoney(shownTotalCents)}</span>
                  <span className="mt-1 block text-sm font-normal text-stone-600">
                    {usesRemoteBackend && !remoteQuote
                      ? 'Consultando importe…'
                      : `${formatVesCents(shownVesTotalCents)} · ${quoteSourceLabel}`}
                  </span>
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-stone-500">
              {usesRemoteBackend && remoteQuote ? (
                <>
                  Cotización del servidor: {shownRate} Bs./USD · {quoteSourceLabel}. Vence{' '}
                  {new Date(remoteQuote.expiresAt).toLocaleTimeString('es-VE')}.
                </>
              ) : usesRemoteBackend ? (
                'El servidor debe confirmar precios, existencias y cotización antes de crear el pedido.'
              ) : (
                <>
                  Conversión referencial ficticia de {shownRate} Bs./USD; no es la tasa BCV. Vence{' '}
                  {new Date(exchangeQuote.expiresAt).toLocaleTimeString('es-VE')}.
                </>
              )}
            </p>
            {usesRemoteBackend ? (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
                El servidor guardará el pedido, pero no se cobra dinero: el pago queda pendiente
                para revisión manual del administrador. No transfieras ni envíes comprobantes.
              </p>
            ) : (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
                Demostración local: no procesa pagos ni envíos. El pedido se guarda solo en este
                navegador. No transfieras ni envíes comprobantes.
              </p>
            )}
            {usesRemoteBackend && remoteQuoteLoading ? (
              <p role="status" className="mt-3 text-xs text-stone-600">
                Validando precios y existencias con el servidor…
              </p>
            ) : null}
            {remoteQuoteError ? (
              <p role="alert" className="mt-3 text-xs text-red-800">
                {remoteQuoteError}
              </p>
            ) : null}
            {quoteConfirmationPending ? (
              <p role="status" className="mt-3 rounded-xl bg-sky-50 p-3 text-xs text-sky-950">
                El importe del servidor difiere del catálogo que tenías abierto. Revisa el detalle y
                confirma con el botón antes de crear el pedido.
              </p>
            ) : null}
            {!usesRemoteBackend && summary.issues.length > 0 ? (
              <p role="alert" className="mt-3 text-xs text-red-800">
                Hay variantes que necesitan revisión. Vuelve al carrito antes de continuar.
              </p>
            ) : null}
            {submitError ? (
              <p role="alert" className="mt-3 text-sm text-red-800">
                {submitError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={
                isSubmitting ||
                (!usesRemoteBackend && !summary.canCheckout) ||
                (usesRemoteBackend &&
                  (!remoteQuote ||
                    remoteQuoteLoading ||
                    paymentOptionsLoading ||
                    paymentOptions.length === 0))
              }
              className={buttonClassName(
                'primary',
                'mt-5 w-full disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              {isSubmitting
                ? 'Guardando…'
                : usesRemoteBackend
                  ? quoteConfirmationPending
                    ? 'Confirmar importe y crear pedido'
                    : 'Crear pedido'
                  : 'Crear pedido de demostración'}
            </button>
            <Link
              to={hasDirectCheckout ? '/catalogo' : '/carrito'}
              className="mt-4 block text-center text-sm text-stone-600 underline underline-offset-4"
            >
              {hasDirectCheckout ? 'Seguir explorando' : 'Volver al carrito'}
            </Link>
          </aside>
        </form>
      )}
    </section>
  )
}
