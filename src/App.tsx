type MilestoneStatus = 'done' | 'next' | 'pending'

interface Milestone {
  readonly title: string
  readonly detail: string
  readonly status: MilestoneStatus
}

const MILESTONES: readonly Milestone[] = [
  {
    title: 'Base técnica',
    detail: 'Vite, React 19, TypeScript estricto, Tailwind, ESLint y Prettier.',
    status: 'done',
  },
  {
    title: 'Catálogo con variantes',
    detail: 'Productos, categorías, tallas, colores y stock por variante.',
    status: 'next',
  },
  {
    title: 'Carrito y totales',
    detail: 'Cantidades, subtotal, envío y persistencia local.',
    status: 'pending',
  },
  {
    title: 'Checkout y pedidos',
    detail: 'Datos del comprador, métodos de entrega y código de pedido.',
    status: 'pending',
  },
  {
    title: 'Panel administrativo',
    detail: 'Productos, pedidos y estados de pago y entrega.',
    status: 'pending',
  },
]

const STATUS_LABELS: Record<MilestoneStatus, string> = {
  done: 'Completado',
  next: 'Siguiente',
  pending: 'Pendiente',
}

const STATUS_STYLES: Record<MilestoneStatus, string> = {
  done: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  next: 'bg-brand-50 text-brand-800 ring-brand-600/20',
  pending: 'bg-stone-100 text-stone-600 ring-stone-500/15',
}

const HIGHLIGHTS: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'Datos ficticios',
    body: 'Sin pagos reales, sin envíos reales y sin integraciones con agencias. El catálogo de prueba llega en la siguiente sesión.',
  },
  {
    title: 'Lógica separada de React',
    body: 'Las reglas de negocio vivirán en src/domain, sin componentes, para poder probarlas y reutilizarlas.',
  },
  {
    title: 'Tipado sin atajos',
    body: 'TypeScript en modo estricto, sin any y con el lint configurado para señalarlo.',
  },
]

export function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-lg bg-brand-900 text-sm font-semibold text-brand-50"
            >
              NM
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Norte Moda</p>
              <p className="text-xs text-stone-500">Tienda conceptual</p>
            </div>
          </div>
          <p className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 ring-1 ring-stone-500/10">
            Demo · datos ficticios
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-16 sm:py-24">
        <p className="text-xs font-semibold tracking-[0.18em] text-brand-700 uppercase">
          Proyecto de portafolio
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Ropa a la medida del comercio de barrio.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-600">
          Norte Moda es una tienda ficticia de ropa pensada para pequeños comercios venezolanos:
          catálogo con tallas y colores reales, carrito, pedidos y un panel para gestionarlos. La
          verificación del pago y el despacho son manuales, como en el mostrador.
        </p>

        <ul className="mt-12 grid gap-4 sm:grid-cols-3">
          {HIGHLIGHTS.map((highlight) => (
            <li
              key={highlight.title}
              className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-sm font-semibold text-stone-900">{highlight.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{highlight.body}</p>
            </li>
          ))}
        </ul>

        <section aria-labelledby="estado-del-proyecto" className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="estado-del-proyecto" className="text-xl font-semibold tracking-tight">
              Estado del proyecto
            </h2>
            <p className="text-sm text-stone-500">Sesión 1 de 18 · versión 0.1.0</p>
          </div>

          <ol className="mt-6 divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {MILESTONES.map((milestone) => (
              <li
                key={milestone.title}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-900">{milestone.title}</p>
                  <p className="mt-1 text-sm text-stone-600">{milestone.detail}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[milestone.status]}`}
                >
                  {STATUS_LABELS[milestone.status]}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-stone-200">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-6 text-xs text-stone-500">
          <p>Norte Moda · Proyecto conceptual, sin fines comerciales.</p>
          <p>React · TypeScript · Vite · Tailwind CSS</p>
        </div>
      </footer>
    </div>
  )
}
