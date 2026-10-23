import { Link } from 'react-router-dom'

import { buttonClassName } from '@/components/ui/button'
import { formatMoney } from '@/domain/money'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const DEMO_ORDERS = [
  {
    code: 'NM-0107',
    customer: 'Ana Pérez',
    phone: '+58 412 000 0001',
    createdAt: '2026-10-22T14:05:00.000Z',
    totalCents: 7600,
    orderStatus: 'Confirmado',
    paymentStatus: 'Por verificar',
    fulfillmentStatus: 'Nuevo',
    reference: 'BANESCO-884201',
    items: ['2 × Camisa Lino Margarita · M · Blanco', '1 × Falda Lino Cumarebo · S · Arena'],
  },
  {
    code: 'NM-0106',
    customer: 'Luis Hernández',
    phone: '+58 414 000 0002',
    createdAt: '2026-10-22T11:40:00.000Z',
    totalCents: 4200,
    orderStatus: 'Confirmado',
    paymentStatus: 'Pagado',
    fulfillmentStatus: 'Preparando',
    reference: null,
    items: ['1 × Vestido Lino Isla · M · Arena'],
  },
  {
    code: 'NM-0105',
    customer: 'María Rojas',
    phone: '+58 424 000 0003',
    createdAt: '2026-10-21T16:15:00.000Z',
    totalCents: 5800,
    orderStatus: 'Confirmado',
    paymentStatus: 'Pagado',
    fulfillmentStatus: 'Despachado',
    reference: null,
    items: ['1 × Pantalón Wide Leg Valencia · L · Negro'],
  },
] as const

const DEMO_HANDOFFS = [
  {
    id: 'demo-handoff-1',
    reason: 'Pidió una persona',
    phone: '+58 412 000 0004',
    orderCode: 'NM-0107',
    createdAt: '2026-10-22T14:20:00.000Z',
    status: 'Abierta',
  },
  {
    id: 'demo-handoff-2',
    reason: 'Referencia de pago enviada por WhatsApp',
    phone: '+58 414 000 0005',
    orderCode: null,
    createdAt: '2026-10-22T12:05:00.000Z',
    status: 'En atención',
  },
] as const

const DEMO_PAYMENT_METHODS = [
  {
    label: 'Pago Móvil',
    detail: 'Banco ficticio · 0102 · teléfono 0412-0000000 · V-00000000',
    status: 'Activo',
  },
  {
    label: 'Transferencia bancaria',
    detail: 'Cuenta ficticia en bolívares · titular Norte Moda, C.A.',
    status: 'Activo',
  },
  {
    label: 'Efectivo en USD',
    detail: 'Solo retiro coordinado en Caracas.',
    status: 'Activo',
  },
  {
    label: 'Efectivo en VES',
    detail: 'Sin instrucciones públicas confirmadas.',
    status: 'Inactivo',
  },
] as const

const DEMO_TOP_SELLERS = [
  { name: 'Camisa Lino Margarita', quantity: 12, revenueCents: 45600 },
  { name: 'Vestido Lino Isla', quantity: 8, revenueCents: 33600 },
  { name: 'Pantalón Wide Leg Valencia', quantity: 5, revenueCents: 24000 },
] as const

const DEMO_LOW_STOCK = [
  { name: 'Camisa Lino Margarita · Blanco · S', stock: 2, sku: 'NM-CAM-MAR-BLA-S' },
  { name: 'Vestido Lino Isla · Arena · M', stock: 0, sku: 'NM-VES-ISL-ARE-M' },
  { name: 'Falda Lino Cumarebo · Arena · S', stock: 1, sku: 'NM-FAL-CUM-ARE-S' },
] as const

/**
 * Vista previa de solo lectura para enseñar la forma del panel cuando todavía
 * no hay Supabase. No hay sesión, datos reales ni acciones habilitadas.
 */
export function AdminDemoPreview() {
  useDocumentTitle('Vista previa del panel · Norte Moda')

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
            Vista previa · solo lectura
          </p>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em] sm:text-5xl">
            Panel administrativo
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
            Así se organiza la operación cuando Supabase está conectado: pedidos, revisión manual de
            pagos, inventario, métodos de cobro y atención de WhatsApp.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/catalogo" className={buttonClassName('secondary', 'py-2')}>
            Ver la tienda
          </Link>
          <Link to="/admin" className={buttonClassName('primary', 'py-2')}>
            Conectar el panel real
          </Link>
        </div>
      </div>

      <div className="mt-7 rounded-2xl border border-amber-900/10 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950">
        <strong>Demostración con datos ficticios.</strong> No hay una sesión de Supabase ni se
        guardan cambios. Los botones de escritura están desactivados a propósito. Para operar con
        pedidos reales hay que aplicar las migraciones, desplegar las Edge Functions y crear la
        cuenta administradora.
      </div>

      <nav aria-label="Secciones del panel" className="mt-6 flex flex-wrap gap-2">
        <a href="#demo-summary" className={buttonClassName('secondary', 'py-2')}>
          Resumen
        </a>
        <a href="#demo-orders" className={buttonClassName('secondary', 'py-2')}>
          Pedidos
        </a>
        <a href="#demo-payments" className={buttonClassName('secondary', 'py-2')}>
          Métodos de pago
        </a>
        <a href="#demo-whatsapp" className={buttonClassName('secondary', 'py-2')}>
          WhatsApp
        </a>
      </nav>

      <section
        id="demo-summary"
        className="mt-5 scroll-mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-stone-900/10 sm:p-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-medium">Resumen del negocio</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-stone-500">
              Período de demostración: 23 de septiembre al 22 de octubre de 2026 (UTC). Los importes
              son ficticios y no representan ingresos reales.
            </p>
          </div>
          <span className="rounded-full bg-sand px-3 py-1 text-[11px] font-medium tracking-wide text-stone-600 uppercase">
            Datos de ejemplo
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DemoMetric title="Pedidos recibidos" value="14" detail="Incluye cancelados." />
          <DemoMetric
            title="Ventas confirmadas"
            value={formatMoney(128400)}
            detail="9 pedidos pagados y confirmados."
          />
          <DemoMetric
            title="Por verificar"
            value={formatMoney(15600)}
            detail="2 pagos esperan revisión manual."
          />
          <DemoMetric title="Por preparar" value="3" detail="Pagados y aún sin despachar." />
          <DemoMetric
            title="Balance aprobado"
            value={formatMoney(128400)}
            detail="Pagos aprobados en el período."
          />
          <DemoMetric
            title="Balance pendiente"
            value={formatMoney(15600)}
            detail="No es ingreso confirmado."
          />
          <DemoMetric title="Productos activos" value="20" detail="Catálogo de demostración." />
          <DemoMetric
            title="Variantes disponibles"
            value="171"
            detail="6 variantes con 3 unidades o menos."
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-paper p-4">
            <h3 className="font-medium">Más vendidos en el período</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {DEMO_TOP_SELLERS.map((product) => (
                <li
                  key={product.name}
                  className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-stone-900/10 pt-2"
                >
                  <span>{product.name}</span>
                  <span className="text-stone-600">
                    {product.quantity} vendidos · {formatMoney(product.revenueCents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-paper p-4">
            <h3 className="font-medium">Existencias bajas</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {DEMO_LOW_STOCK.map((variant) => (
                <li
                  key={variant.sku}
                  className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-stone-900/10 pt-2"
                >
                  <span>{variant.name}</span>
                  <span className="text-stone-600">
                    {variant.stock} · SKU {variant.sku}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <h2 id="demo-orders" className="mt-9 scroll-mt-6 text-xl font-medium">
        Pedidos ({DEMO_ORDERS.length})
      </h2>
      <p className="mt-1 text-sm text-stone-600">
        La referencia del comprador deja el pago en revisión. Solo una persona autorizada puede
        aprobarlo.
      </p>
      <ul className="mt-4 space-y-4">
        {DEMO_ORDERS.map((order) => (
          <li
            key={order.code}
            className="rounded-3xl bg-white/70 p-5 ring-1 ring-stone-900/10 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-medium">{order.code}</h3>
                <p className="mt-1 text-sm text-stone-600">
                  {order.customer} · {order.phone}
                </p>
              </div>
              <strong className="text-lg tabular-nums">{formatMoney(order.totalCents)}</strong>
            </div>
            <ul className="mt-4 divide-y divide-stone-900/10 border-y border-stone-900/10">
              {order.items.map((item) => (
                <li key={item} className="py-3 text-sm">
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <DemoMetric title="Pedido" value={order.orderStatus} />
              <DemoMetric title="Pago" value={order.paymentStatus} />
              <DemoMetric title="Logística" value={order.fulfillmentStatus} />
            </div>
            {order.reference ? (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                Referencia informada: <strong>{order.reference}</strong>. Requiere verificación
                manual; no confirma el pago.
              </p>
            ) : null}
            <p className="mt-3 text-xs text-stone-500">
              Creado {new Date(order.createdAt).toLocaleString('es-VE')}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled
                title="Disponible al conectar Supabase"
                className="rounded-full bg-white px-3 py-2 text-xs ring-1 ring-stone-900/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {order.paymentStatus === 'Por verificar'
                  ? 'Confirmar pago revisado'
                  : 'Actualizar pedido'}
              </button>
              <span className="text-[11px] text-stone-500">Solo lectura</span>
            </div>
          </li>
        ))}
      </ul>

      <section id="demo-payments" className="mt-9 scroll-mt-6">
        <h2 className="text-xl font-medium">Métodos de pago</h2>
        <p className="mt-1 text-sm text-stone-600">
          Configuración ficticia. Un método solo se muestra en el checkout cuando tiene
          instrucciones públicas y está activo.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {DEMO_PAYMENT_METHODS.map((method) => (
            <article
              key={method.label}
              className="rounded-2xl bg-white/70 p-4 ring-1 ring-stone-900/10"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium">{method.label}</h3>
                <span
                  className={
                    method.status === 'Activo'
                      ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-800 uppercase'
                      : 'rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-500 uppercase'
                  }
                >
                  {method.status}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{method.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="demo-whatsapp" className="mt-9 scroll-mt-6 border-t border-stone-900/10 pt-7">
        <h2 className="text-xl font-medium">Atención de WhatsApp ({DEMO_HANDOFFS.length})</h2>
        <p className="mt-1 text-sm text-stone-600">
          Solicitudes derivadas a una persona, sin guardar el texto completo de la conversación.
        </p>
        <ul className="mt-4 space-y-3">
          {DEMO_HANDOFFS.map((handoff) => (
            <li key={handoff.id} className="rounded-2xl bg-white/70 p-4 ring-1 ring-stone-900/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{handoff.reason}</p>
                  <p className="mt-1 text-sm text-stone-600">
                    WhatsApp {handoff.phone}
                    {handoff.orderCode ? ` · Pedido ${handoff.orderCode}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {new Date(handoff.createdAt).toLocaleString('es-VE')} · {handoff.status}
                  </p>
                </div>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-medium text-stone-500 uppercase">
                  Solo lectura
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 rounded-3xl bg-ink p-6 text-paper sm:p-8">
        <p className="text-[11px] font-medium tracking-[0.22em] text-brand-200 uppercase">
          Siguiente paso
        </p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight">
          Convertir esta vista en el panel real
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-300">
          Se necesitan un proyecto Supabase, las 11 migraciones, las 16 Edge Functions y una cuenta
          administradora. El código ya está en el repositorio; la conexión no se simuló en esta
          demostración.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/admin" className={buttonClassName('secondary', 'py-2')}>
            Ver requisitos de conexión
          </Link>
          <a
            href="https://github.com/ReinaldoGoCode/ProyectOne/blob/main/docs/IMPLEMENTACION_BACKEND.md"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium text-stone-300 ring-1 ring-white/20 transition hover:text-white hover:ring-white/40"
          >
            Abrir documentación
          </a>
        </div>
      </div>
    </section>
  )
}

function DemoMetric({
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
