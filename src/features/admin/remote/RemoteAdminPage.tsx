import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link, useSearchParams } from 'react-router-dom'

import { buttonClassName } from '@/components/ui/button'
import { useCatalog } from '@/app/providers/catalogContext'
import {
  applyRemoteInventoryImport,
  listRemoteAdminCatalog,
  listRemoteAdminPaymentMethods,
  listRemoteAdminOrders,
  getRemoteAdminDashboardSummary,
  listRemoteWhatsAppHandoffs,
  updateRemoteAdminOrder,
  updateRemoteWhatsAppHandoff,
  uploadRemoteProductImage,
  saveRemoteAdminPaymentMethods,
} from '@/data/repositories/remoteOrderGateway'
import type {
  RemoteAdminCatalog,
  RemoteAdminOrder,
  RemoteAdminDashboardSummary,
  RemoteAdminPaymentMethod,
  RemoteWhatsAppHandoff,
} from '@/data/repositories/remoteOrderGateway'
import type { Catalog } from '@/domain/types'
import { AdminDemoPreview } from './AdminDemoPreview'
import { RemoteInventoryPanel } from './RemoteInventoryPanel'
import { RemotePaymentSettingsPanel } from './RemotePaymentSettingsPanel'
import { formatMoney } from '@/domain/money'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const ORDER_LABELS: Readonly<Record<RemoteAdminOrder['orderStatus'], string>> = {
  awaiting_payment: 'Pendiente de pago',
  confirmed: 'Confirmado',
  inventory_exception: 'Incidencia de inventario',
  cancelled: 'Cancelado',
}
const PAYMENT_LABELS: Readonly<Record<RemoteAdminOrder['paymentStatus'], string>> = {
  pending: 'Pendiente',
  review: 'Por verificar',
  paid: 'Pagado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
}
const FULFILLMENT_LABELS: Readonly<Record<RemoteAdminOrder['fulfillmentStatus'], string>> = {
  new: 'Nuevo',
  preparing: 'Preparando',
  shipped: 'Despachado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}
const HANDOFF_REASON_LABELS: Readonly<Record<RemoteWhatsAppHandoff['reason'], string>> = {
  human_requested: 'Pidió una persona',
  payment_instructions_missing: 'Faltan instrucciones de pago',
  unknown_request: 'El bot no pudo responder',
  payment_reference_submitted: 'Referencia de pago enviada por WhatsApp',
  shipping_exception: 'Incidencia de entrega',
  stock_exception: 'Incidencia de existencias',
}

const MAX_DASHBOARD_PERIOD_DAYS = 366

function getDefaultDashboardPeriod(): { from: string; to: string } {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 29)
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
}

function dashboardPeriodIssue(from: string, to: string): string | null {
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }
  if (!validDate(from) || !validDate(to)) return 'Selecciona fechas de inicio y fin válidas.'
  const start = new Date(`${from}T00:00:00.000Z`).getTime()
  const end = new Date(`${to}T00:00:00.000Z`).getTime()
  if (end < start) return 'La fecha final debe ser igual o posterior a la inicial.'
  if (end - start >= MAX_DASHBOARD_PERIOD_DAYS * 24 * 60 * 60 * 1000) {
    return `El período máximo es de ${String(MAX_DASHBOARD_PERIOD_DAYS)} días.`
  }
  return null
}

export function RemoteAdminPage() {
  useDocumentTitle('Panel protegido · Norte Moda')
  const { refreshCatalog } = useCatalog()
  const [client] = useState(() => getSupabaseBrowserClient())
  const [searchParams] = useSearchParams()
  const demoPreview = !client && searchParams.get('vista') === 'demo'
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [orders, setOrders] = useState<readonly RemoteAdminOrder[]>([])
  const [adminCatalog, setAdminCatalog] = useState<RemoteAdminCatalog | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<readonly RemoteAdminPaymentMethod[]>([])
  const [handoffs, setHandoffs] = useState<readonly RemoteWhatsAppHandoff[]>([])
  const [dashboardSummary, setDashboardSummary] = useState<RemoteAdminDashboardSummary | null>(null)
  const [dashboardPeriod, setDashboardPeriod] = useState(getDefaultDashboardPeriod)
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0)
  const [dashboardError, setDashboardError] = useState('')
  const [loading, setLoading] = useState(false)
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [busyHandoffId, setBusyHandoffId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!client) return
    void client.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) setLoading(true)
    })
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (nextSession) setLoading(true)
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [client])

  useEffect(() => {
    if (!session) return
    let mounted = true
    void Promise.all([
      listRemoteAdminOrders(),
      listRemoteWhatsAppHandoffs(),
      listRemoteAdminCatalog(),
      listRemoteAdminPaymentMethods(),
    ])
      .then(([nextOrders, nextHandoffs, nextCatalog, nextPaymentMethods]) => {
        if (mounted) {
          setOrders(nextOrders)
          setHandoffs(nextHandoffs)
          setAdminCatalog(nextCatalog)
          setPaymentMethods(nextPaymentMethods)
        }
      })
      .catch((caught: unknown) => {
        if (mounted) {
          setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los pedidos.')
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [session])

  useEffect(() => {
    if (!session) return
    const issue = dashboardPeriodIssue(dashboardPeriod.from, dashboardPeriod.to)
    if (issue) return
    let mounted = true
    void getRemoteAdminDashboardSummary(dashboardPeriod.from, dashboardPeriod.to)
      .then((summary) => {
        if (mounted) setDashboardSummary(summary)
      })
      .catch((caught: unknown) => {
        if (mounted) {
          setDashboardError(
            caught instanceof Error ? caught.message : 'No se pudo cargar el resumen remoto.',
          )
        }
      })
    return () => {
      mounted = false
    }
  }, [session, dashboardPeriod, dashboardRefreshKey])

  async function signIn(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!client) return
    setError('')
    setNotice('')
    setLoading(true)
    const { error: authError } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (authError) {
      setLoading(false)
      setError('No se pudo iniciar sesión. Verifica tus datos y que la cuenta esté habilitada.')
      return
    }
    setPassword('')
  }

  async function signOut(): Promise<void> {
    if (!client) return
    await client.auth.signOut()
    setOrders([])
    setHandoffs([])
    setAdminCatalog(null)
    setPaymentMethods([])
    setDashboardSummary(null)
    setNotice('Sesión cerrada.')
  }

  async function requestPasswordRecovery(): Promise<void> {
    if (!client || !email.trim()) {
      setError(
        'Escribe el correo de la cuenta administradora para enviarte el enlace de recuperación.',
      )
      return
    }
    setError('')
    setNotice('')
    setLoading(true)
    const { error: recoveryError } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: new URL(`${import.meta.env.BASE_URL}admin`, window.location.origin).toString(),
    })
    setLoading(false)
    if (recoveryError) {
      setError(
        'No se pudo iniciar la recuperación. Comprueba que el correo existe y que la URL /admin está permitida en Supabase.',
      )
      return
    }
    setNotice(
      'Si la cuenta existe, Supabase enviará un enlace de recuperación al correo registrado.',
    )
  }

  async function updatePassword(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!client || newPassword.length < 10) {
      setError('La nueva contraseña debe tener al menos 10 caracteres.')
      return
    }
    setLoading(true)
    setError('')
    const { error: updateError } = await client.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (updateError) {
      setError('No se pudo actualizar la contraseña. Vuelve a solicitar un enlace de recuperación.')
      return
    }
    setRecoveryMode(false)
    setNewPassword('')
    setNotice('Contraseña actualizada. La sesión está iniciada.')
  }

  async function applyChange(
    order: RemoteAdminOrder,
    action: 'payment' | 'fulfillment' | 'resolve_inventory',
    status?: string,
  ): Promise<void> {
    setError('')
    setNotice('')
    setBusyOrderId(order.id)
    try {
      await updateRemoteAdminOrder({
        orderId: order.id,
        action,
        ...(status ? { status } : {}),
        note:
          action === 'payment' && status === 'paid'
            ? 'Pago verificado manualmente por administrador autorizado.'
            : 'Cambio guardado por administrador autorizado.',
      })
      const [nextOrders, nextHandoffs, nextCatalog, nextPaymentMethods] = await Promise.all([
        listRemoteAdminOrders(),
        listRemoteWhatsAppHandoffs(),
        listRemoteAdminCatalog(),
        listRemoteAdminPaymentMethods(),
      ])
      setOrders(nextOrders)
      setHandoffs(nextHandoffs)
      setAdminCatalog(nextCatalog)
      setPaymentMethods(nextPaymentMethods)
      setDashboardRefreshKey((key) => key + 1)
      setNotice(`Pedido ${order.code} actualizado.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el cambio.')
    } finally {
      setBusyOrderId(null)
    }
  }

  async function applyHandoffChange(
    handoff: RemoteWhatsAppHandoff,
    status: 'claimed' | 'resolved',
  ): Promise<void> {
    setError('')
    setNotice('')
    setBusyHandoffId(handoff.id)
    try {
      await updateRemoteWhatsAppHandoff(handoff.id, status)
      setHandoffs(await listRemoteWhatsAppHandoffs())
      setNotice(
        status === 'claimed'
          ? 'Solicitud asignada a tu sesión.'
          : 'Solicitud marcada como atendida.',
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo actualizar la solicitud.')
    } finally {
      setBusyHandoffId(null)
    }
  }

  async function applyCatalogImport(nextCatalog: Catalog, expectedCatalog: Catalog) {
    const result = await applyRemoteInventoryImport(nextCatalog, expectedCatalog)
    try {
      setAdminCatalog(await listRemoteAdminCatalog())
      await refreshCatalog()
      setDashboardRefreshKey((key) => key + 1)
      setError('')
    } catch {
      setError(
        'La importación se guardó, pero no se pudo actualizar la vista. Pulsa “Actualizar datos”.',
      )
    }
    return result
  }

  async function uploadProductImage(productId: string, file: File): Promise<void> {
    await uploadRemoteProductImage(productId, file)
    const nextCatalog = await listRemoteAdminCatalog()
    setAdminCatalog(nextCatalog)
    await refreshCatalog()
  }

  async function savePaymentMethods(
    methods: readonly Pick<RemoteAdminPaymentMethod, 'method' | 'active' | 'instructions'>[],
  ): Promise<readonly RemoteAdminPaymentMethod[]> {
    const updated = await saveRemoteAdminPaymentMethods(methods)
    setPaymentMethods(updated)
    return updated
  }

  if (demoPreview) {
    return <AdminDemoPreview />
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
        Administración protegida
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-medium tracking-[-0.04em] sm:text-5xl">
            Panel administrativo
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
            Catálogo, inventario y pedidos remotos. Cada operación sensible vuelve a comprobar tu
            sesión y el permiso de administración en el servidor.
          </p>
        </div>
        {session ? (
          <button
            type="button"
            onClick={() => {
              void signOut()
            }}
            className={buttonClassName('secondary')}
          >
            Cerrar sesión
          </button>
        ) : null}
      </div>

      {!client ? (
        <div className="mt-7 rounded-2xl border border-amber-900/10 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950">
          <p>
            El backend aún no está configurado en este sitio. Completa los pasos de{' '}
            <code>docs/IMPLEMENTACION_BACKEND.md</code> para activar la sesión protegida y las
            operaciones reales.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/admin?vista=demo" className={buttonClassName('primary', 'py-2')}>
              Ver vista previa del panel
            </Link>
            <a
              href="https://github.com/ReinaldoGoCode/ProyectOne/blob/main/docs/IMPLEMENTACION_BACKEND.md"
              target="_blank"
              rel="noreferrer"
              className={buttonClassName('secondary', 'py-2')}
            >
              Abrir requisitos
            </a>
          </div>
          <p className="mt-3 text-xs text-amber-900/80">
            La vista previa usa datos ficticios, no permite iniciar sesión ni guardar cambios.
          </p>
        </div>
      ) : recoveryMode ? (
        <form
          onSubmit={(event) => {
            void updatePassword(event)
          }}
          className="mt-7 max-w-md rounded-3xl bg-white/70 p-6 ring-1 ring-stone-900/10"
        >
          <h2 className="text-xl font-medium">Crear una nueva contraseña</h2>
          <label className="mt-5 block text-xs font-medium text-stone-600">
            Nueva contraseña
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.currentTarget.value)
              }}
              className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm ring-1 ring-stone-900/12"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className={buttonClassName('primary', 'mt-5 w-full')}
          >
            {loading ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      ) : !session ? (
        <form
          onSubmit={(event) => {
            void signIn(event)
          }}
          className="mt-7 max-w-md rounded-3xl bg-white/70 p-6 ring-1 ring-stone-900/10"
        >
          <h2 className="text-xl font-medium">Iniciar sesión</h2>
          <label className="mt-5 block text-xs font-medium text-stone-600">
            Correo de administración
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.currentTarget.value)
              }}
              className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm ring-1 ring-stone-900/12"
            />
          </label>
          <label className="mt-4 block text-xs font-medium text-stone-600">
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.currentTarget.value)
              }}
              className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm ring-1 ring-stone-900/12"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className={buttonClassName('primary', 'mt-5 w-full disabled:opacity-50')}
          >
            {loading ? 'Conectando…' : 'Entrar al panel'}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-stone-500">
            No hay credenciales predeterminadas. La persona administradora debe crearse en Supabase
            Auth.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void requestPasswordRecovery()}
            className="mt-4 text-sm text-stone-600 underline underline-offset-4 disabled:opacity-50"
          >
            {loading ? 'Procesando…' : 'Olvidé mi contraseña'}
          </button>
        </form>
      ) : (
        <div className="mt-7">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-stone-900/10">
            <p className="text-sm text-stone-600">
              Sesión iniciada: {session.user.email ?? 'administrador'}
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setLoading(true)
                setDashboardError('')
                void Promise.all([
                  listRemoteAdminOrders(),
                  listRemoteWhatsAppHandoffs(),
                  listRemoteAdminCatalog(),
                  listRemoteAdminPaymentMethods(),
                ])
                  .then(([nextOrders, nextHandoffs, nextCatalog, nextPaymentMethods]) => {
                    setOrders(nextOrders)
                    setHandoffs(nextHandoffs)
                    setAdminCatalog(nextCatalog)
                    setPaymentMethods(nextPaymentMethods)
                    setDashboardRefreshKey((key) => key + 1)
                  })
                  .catch((caught: unknown) => {
                    setError(caught instanceof Error ? caught.message : 'Error de consulta.')
                  })
                  .finally(() => {
                    setLoading(false)
                  })
              }}
              className={buttonClassName('secondary', 'py-2')}
            >
              {loading ? 'Actualizando…' : 'Actualizar datos'}
            </button>
          </div>
          <nav aria-label="Secciones del panel" className="mt-5 flex flex-wrap gap-2">
            <a href="#admin-inventory" className={buttonClassName('secondary', 'py-2')}>
              Catálogo e inventario
            </a>
            <a href="#admin-orders" className={buttonClassName('secondary', 'py-2')}>
              Pedidos
            </a>
            <a href="#admin-payments" className={buttonClassName('secondary', 'py-2')}>
              Métodos de pago
            </a>
            <a href="#admin-whatsapp" className={buttonClassName('secondary', 'py-2')}>
              Atención de WhatsApp
            </a>
          </nav>

          <section className="mt-5 rounded-3xl bg-white/70 p-5 ring-1 ring-stone-900/10 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="admin-summary" className="text-xl font-medium">
                  Resumen del negocio
                </h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-stone-500">
                  Los pedidos y pagos reflejan el período seleccionado en UTC. Ventas confirmadas
                  requieren un pedido confirmado y un pago aprobado; los cancelados se excluyen.
                  Preparación e inventario muestran el estado actual.
                </p>
              </div>
              <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
                <label className="text-xs font-medium text-stone-600">
                  Desde (UTC)
                  <input
                    type="date"
                    value={dashboardPeriod.from}
                    onChange={(event) => {
                      setDashboardSummary(null)
                      setDashboardError('')
                      setDashboardPeriod((period) => ({
                        ...period,
                        from: event.currentTarget.value,
                      }))
                    }}
                    className="mt-1.5 min-h-10 w-full rounded-xl bg-white px-3 text-sm ring-1 ring-stone-900/12"
                  />
                </label>
                <label className="text-xs font-medium text-stone-600">
                  Hasta (UTC)
                  <input
                    type="date"
                    value={dashboardPeriod.to}
                    onChange={(event) => {
                      setDashboardSummary(null)
                      setDashboardError('')
                      setDashboardPeriod((period) => ({
                        ...period,
                        to: event.currentTarget.value,
                      }))
                    }}
                    className="mt-1.5 min-h-10 w-full rounded-xl bg-white px-3 text-sm ring-1 ring-stone-900/12"
                  />
                </label>
              </div>
            </div>
            {!dashboardSummary &&
            !dashboardError &&
            !dashboardPeriodIssue(dashboardPeriod.from, dashboardPeriod.to) ? (
              <p className="mt-4 text-sm text-stone-500">Calculando resumen desde Supabase…</p>
            ) : null}
            {dashboardPeriodIssue(dashboardPeriod.from, dashboardPeriod.to) || dashboardError ? (
              <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                {dashboardPeriodIssue(dashboardPeriod.from, dashboardPeriod.to) ?? dashboardError}
              </p>
            ) : null}
            {dashboardSummary ? (
              <>
                <p className="mt-4 text-xs text-stone-500">
                  Período: {dashboardSummary.period.from} – {dashboardSummary.period.to} (UTC).
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatusCard
                    title="Pedidos recibidos"
                    value={String(dashboardSummary.ordersReceived)}
                    detail="Incluye pedidos cancelados."
                  />
                  <StatusCard
                    title="Ventas confirmadas"
                    value={formatMoney(dashboardSummary.confirmedSalesCents)}
                    detail={`${String(dashboardSummary.confirmedSalesCount)} pedidos pagados y confirmados; total final incluido envío.`}
                  />
                  <StatusCard
                    title="Pagos pendientes o por verificar"
                    value={formatMoney(dashboardSummary.pendingPaymentCents)}
                    detail={`${String(dashboardSummary.pendingPaymentCount)} pedidos; total final incluido envío, no es ingreso confirmado.`}
                  />
                  <StatusCard
                    title="Pedidos por preparar"
                    value={String(dashboardSummary.preparationBacklogCount)}
                    detail="Pendientes ahora: pagados y confirmados, aún sin despachar."
                  />
                  <StatusCard
                    title="Balance aprobado"
                    value={formatMoney(dashboardSummary.paidBalanceCents)}
                    detail="Pagos marcados como pagados en el período, excluye pedidos cancelados."
                  />
                  <StatusCard
                    title="Balance pendiente"
                    value={formatMoney(dashboardSummary.pendingBalanceCents)}
                    detail="Pagos pendientes o por verificar en el período."
                  />
                  <StatusCard
                    title="Productos activos"
                    value={String(dashboardSummary.activeProductCount)}
                    detail="Catálogo actual."
                  />
                  <StatusCard
                    title="Variantes disponibles"
                    value={String(dashboardSummary.availableVariantCount)}
                    detail="Variantes activas con existencias mayores que cero."
                  />
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl bg-paper p-4">
                    <h3 className="font-medium">Más vendidos en el período</h3>
                    <p className="mt-1 text-xs text-stone-500">
                      Cantidades de pedidos pagados y confirmados; máximo cinco productos.
                    </p>
                    {dashboardSummary.topSellers.length ? (
                      <ul className="mt-3 space-y-2 text-sm">
                        {dashboardSummary.topSellers.map((product) => (
                          <li
                            key={product.productId}
                            className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-stone-900/10 pt-2"
                          >
                            <span>{product.productName}</span>
                            <span className="text-stone-600">
                              {String(product.quantity)} vendidos ·{' '}
                              {formatMoney(product.revenueCents)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-stone-500">
                        No hay ventas confirmadas para este período.
                      </p>
                    )}
                  </div>
                  <div className="rounded-2xl bg-paper p-4">
                    <h3 className="font-medium">Existencias bajas</h3>
                    <p className="mt-1 text-xs text-stone-500">
                      {dashboardSummary.lowStockVariantCount} variantes activas con 3 unidades o
                      menos; incluye agotadas. Se muestran hasta 10.
                    </p>
                    {dashboardSummary.lowStockVariants.length ? (
                      <ul className="mt-3 space-y-2 text-sm">
                        {dashboardSummary.lowStockVariants.map((variant) => (
                          <li
                            key={variant.variantId}
                            className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-stone-900/10 pt-2"
                          >
                            <span>
                              {variant.productName} · {variant.color} · {variant.size}
                            </span>
                            <span className="text-stone-600">
                              {String(variant.stock)} · SKU {variant.sku}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-stone-500">
                        No hay variantes con poco stock.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </section>

          {adminCatalog ? (
            <RemoteInventoryPanel
              catalog={adminCatalog.catalog}
              movements={adminCatalog.movements}
              onImport={applyCatalogImport}
              onImageUpload={uploadProductImage}
            />
          ) : (
            <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
              El catálogo remoto y el historial de existencias aún no están cargados. Comprueba que
              estén aplicadas las migraciones de inventario.
            </p>
          )}

          {paymentMethods.length ? (
            <RemotePaymentSettingsPanel
              key={JSON.stringify(paymentMethods)}
              methods={paymentMethods}
              onSave={savePaymentMethods}
            />
          ) : (
            <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
              La configuración de pagos no está disponible hasta aplicar su migración.
            </p>
          )}

          <h2 id="admin-orders" className="mt-8 scroll-mt-6 text-xl font-medium">
            Pedidos ({orders.length})
          </h2>
          {orders.length === 0 && !loading ? (
            <p className="mt-3 rounded-2xl bg-white/70 p-5 text-sm text-stone-600">
              Todavía no hay pedidos remotos.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="rounded-3xl bg-white/70 p-5 ring-1 ring-stone-900/10 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-medium">{order.code}</h3>
                      <p className="mt-1 text-sm text-stone-600">
                        {order.customer.firstName} {order.customer.lastName} ·{' '}
                        {order.customer.phone}
                      </p>
                    </div>
                    <strong className="text-lg tabular-nums">
                      {formatMoney(order.totalCents)}
                    </strong>
                  </div>
                  <ul className="mt-4 divide-y divide-stone-900/10 border-y border-stone-900/10">
                    {order.items.map((item, index) => (
                      <li
                        key={`${order.id}-${String(index)}`}
                        className="flex justify-between gap-3 py-3 text-sm"
                      >
                        <span>
                          {item.quantity} × {item.productName} · {item.size} · {item.color}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <StatusCard title="Pedido" value={ORDER_LABELS[order.orderStatus]} />
                    <StatusCard title="Pago" value={PAYMENT_LABELS[order.paymentStatus]} />
                    <StatusCard
                      title="Logística"
                      value={FULFILLMENT_LABELS[order.fulfillmentStatus]}
                    />
                  </div>
                  {order.paymentReference ? (
                    <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                      Referencia informada por WhatsApp: <strong>{order.paymentReference}</strong>.
                      Requiere verificación manual; no confirma el pago.
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-stone-500">
                    Creado {new Date(order.createdAt).toLocaleString('es-VE')}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.paymentStatus === 'pending' ? (
                      <ActionButton
                        busy={busyOrderId === order.id}
                        onClick={() => {
                          void applyChange(order, 'payment', 'review')
                        }}
                      >
                        Registrar comprobante para revisión
                      </ActionButton>
                    ) : null}
                    {order.paymentStatus === 'review' ? (
                      <>
                        <ActionButton
                          busy={busyOrderId === order.id}
                          onClick={() => {
                            void applyChange(order, 'payment', 'paid')
                          }}
                        >
                          Confirmar pago revisado
                        </ActionButton>
                        <ActionButton
                          busy={busyOrderId === order.id}
                          onClick={() => {
                            void applyChange(order, 'payment', 'rejected')
                          }}
                        >
                          Rechazar pago
                        </ActionButton>
                      </>
                    ) : null}
                    {order.orderStatus === 'inventory_exception' ? (
                      <ActionButton
                        busy={busyOrderId === order.id}
                        onClick={() => {
                          void applyChange(order, 'resolve_inventory')
                        }}
                      >
                        Revalidar stock tras reposición
                      </ActionButton>
                    ) : null}
                    {order.paymentStatus === 'paid' &&
                    order.orderStatus === 'confirmed' &&
                    order.fulfillmentStatus === 'new' ? (
                      <ActionButton
                        busy={busyOrderId === order.id}
                        onClick={() => {
                          void applyChange(order, 'fulfillment', 'preparing')
                        }}
                      >
                        Iniciar preparación
                      </ActionButton>
                    ) : null}
                    {order.fulfillmentStatus === 'preparing' ? (
                      <ActionButton
                        busy={busyOrderId === order.id}
                        onClick={() => {
                          void applyChange(order, 'fulfillment', 'shipped')
                        }}
                      >
                        Marcar despachado
                      </ActionButton>
                    ) : null}
                    {order.fulfillmentStatus === 'shipped' ? (
                      <ActionButton
                        busy={busyOrderId === order.id}
                        onClick={() => {
                          void applyChange(order, 'fulfillment', 'delivered')
                        }}
                      >
                        Marcar entregado
                      </ActionButton>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <section
            id="admin-whatsapp"
            className="mt-10 scroll-mt-6 border-t border-stone-900/10 pt-7"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-xl font-medium">Atención de WhatsApp ({handoffs.length})</h2>
                <p className="mt-1 text-sm text-stone-600">
                  Solicitudes sin guardar el texto de la conversación. El acceso está limitado a
                  administradores.
                </p>
              </div>
            </div>
            {handoffs.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-white/70 p-5 text-sm text-stone-600">
                No hay solicitudes pendientes.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {handoffs.map((handoff) => (
                  <li
                    key={handoff.id}
                    className="rounded-2xl bg-white/70 p-4 ring-1 ring-stone-900/10"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{HANDOFF_REASON_LABELS[handoff.reason]}</p>
                        <p className="mt-1 text-sm text-stone-600">
                          WhatsApp +{handoff.senderPhone}
                          {handoff.orderCode ? ` · Pedido ${handoff.orderCode}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          {new Date(handoff.createdAt).toLocaleString('es-VE')} ·{' '}
                          {handoff.status === 'open'
                            ? 'Abierta'
                            : handoff.status === 'claimed'
                              ? 'En atención'
                              : 'Atendida'}
                        </p>
                      </div>
                      {handoff.status === 'open' ? (
                        <ActionButton
                          busy={busyHandoffId === handoff.id}
                          onClick={() => void applyHandoffChange(handoff, 'claimed')}
                        >
                          Tomar solicitud
                        </ActionButton>
                      ) : null}
                      {handoff.status !== 'resolved' ? (
                        <ActionButton
                          busy={busyHandoffId === handoff.id}
                          onClick={() => void applyHandoffChange(handoff, 'resolved')}
                        >
                          Marcar atendida
                        </ActionButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-5 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p aria-live="polite" className="mt-5 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}
    </section>
  )
}

function StatusCard({
  title,
  value,
  detail,
}: {
  readonly title: string
  readonly value: string
  readonly detail?: string
}) {
  return (
    <div className="rounded-2xl bg-paper p-3">
      <p className="text-xs text-stone-500">{title}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
      {detail ? <p className="mt-1 text-[11px] leading-relaxed text-stone-500">{detail}</p> : null}
    </div>
  )
}

function ActionButton({
  busy,
  onClick,
  children,
}: {
  readonly busy: boolean
  readonly onClick: () => void
  readonly children: string
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded-full bg-white px-3 py-2 text-xs ring-1 ring-stone-900/15 hover:bg-stone-50 disabled:opacity-50"
    >
      {busy ? 'Guardando…' : children}
    </button>
  )
}
