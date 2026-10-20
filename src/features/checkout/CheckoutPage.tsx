import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import type { SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'

import { useCatalog } from '@/app/providers/catalogContext'
import { useCart } from '@/app/providers/cartContext'
import { useOrders } from '@/app/providers/orderContext'
import { buttonClassName } from '@/components/ui/button'
import { DELIVERY_METHOD_LABELS, PAYMENT_METHOD_LABELS } from '@/domain/labels'
import { createOrderItems } from '@/domain/order'
import { summarizeCart } from '@/domain/cart'
import { formatMoney } from '@/domain/money'
import { getShippingCents } from '@/domain/shipping'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

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
    paymentMethod: z.enum(['pago_movil', 'transferencia', 'efectivo']),
    customerNote: z.string().trim().max(300, 'La nota puede tener hasta 300 caracteres.'),
  })
  .superRefine((value, context) => {
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
  const { catalog } = useCatalog()
  const { lines, clear } = useCart()
  const { create } = useOrders()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState('')
  const {
    register,
    control,
    handleSubmit,
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
      paymentMethod: 'pago_movil',
      customerNote: '',
    },
  })
  const deliveryMethod = useWatch({ control, name: 'deliveryMethod' })
  const summary = summarizeCart(lines, catalog)
  const shippingCents = getShippingCents(deliveryMethod)
  const totalCents = summary.subtotalCents + shippingCents

  const onSubmit: SubmitHandler<CheckoutFormValues> = (values) => {
    setSubmitError('')
    const latestSummary = lines.length ? summarizeCart(lines, catalog) : null
    if (!latestSummary?.canCheckout) {
      setSubmitError(
        'El carrito cambió o ya no tiene artículos disponibles. Vuelve al carrito y revisa las variantes.',
      )
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
      paymentReference: null,
      customerNote: values.customerNote.trim() || null,
      items: createOrderItems(latestSummary.details),
      shippingCents,
    })

    if (order === null) {
      setSubmitError(
        'No pudimos guardar el pedido en este navegador. No se creó una confirmación; inténtalo de nuevo.',
      )
      return
    }

    clear()
    void navigate(`/pedido?codigo=${encodeURIComponent(order.code)}&creado=1`)
  }

  function fieldError(name: keyof CheckoutFormValues): string | undefined {
    return errors[name]?.message
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
        Pedido de demostración
      </p>
      <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em] sm:text-5xl">Checkout</h1>

      {lines.length === 0 ? (
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
          <div className="space-y-7">
            <section className="rounded-3xl bg-white/60 p-5 ring-1 ring-stone-900/10 sm:p-7">
              <h2 className="text-xl font-medium">Tus datos</h2>
              <p className="mt-2 text-xs text-stone-500">
                Solo pedimos un nombre y teléfono para esta coordinación ficticia. No se solicita
                cédula ni correo.
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
              <label className="mt-4 block text-xs font-medium text-stone-600">
                Método previsto
                <select {...register('paymentMethod')} className={INPUT_CLASS}>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-xs leading-relaxed text-stone-500">
                Elegir un método no realiza un pago ni confirma una transferencia. El administrador
                registra la verificación manualmente.
              </p>
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
              {summary.details.map((detail) => (
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
                <dd>{formatMoney(summary.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between text-stone-600">
                <dt>Entrega</dt>
                <dd>{formatMoney(shippingCents)}</dd>
              </div>
              <div className="flex justify-between border-t border-stone-900/10 pt-3 text-base font-medium">
                <dt>Total</dt>
                <dd>{formatMoney(totalCents)}</dd>
              </div>
            </dl>
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
              Demostración local: no procesa pagos ni envíos. El pedido se guardará solo en este
              navegador.
            </p>
            {summary.issues.length > 0 ? (
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
              disabled={isSubmitting || !summary.canCheckout}
              className={buttonClassName(
                'primary',
                'mt-5 w-full disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              {isSubmitting ? 'Guardando…' : 'Crear pedido de demostración'}
            </button>
            <Link
              to="/carrito"
              className="mt-4 block text-center text-sm text-stone-600 underline underline-offset-4"
            >
              Volver al carrito
            </Link>
          </aside>
        </form>
      )}
    </section>
  )
}
