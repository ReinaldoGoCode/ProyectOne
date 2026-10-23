import { Outlet, ScrollRestoration } from 'react-router-dom'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { useCatalog } from '@/app/providers/catalogContext'

export function StoreLayout() {
  const { catalogMode } = useCatalog()
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
      >
        Saltar al contenido
      </a>

      <SiteHeader />

      <div
        role="status"
        className={`px-5 py-2 text-center text-xs font-medium ${catalogMode === 'error' ? 'bg-red-50 text-red-900' : catalogMode === 'demo' ? 'bg-stone-900 text-white' : catalogMode === 'loading' ? 'bg-amber-50 text-amber-950' : 'bg-brand-50 text-brand-900'}`}
      >
        {catalogMode === 'demo'
          ? 'Demo local · pedidos e inventario quedan guardados solo en este navegador.'
          : catalogMode === 'loading'
            ? 'Conectando con el catálogo remoto…'
            : catalogMode === 'error'
              ? 'No se pudo leer el catálogo remoto. Se ocultó el catálogo local para evitar mostrar datos como si fueran del servidor.'
              : 'Catálogo de Supabase conectado · el cambio de moneda y los pagos continúan en modo demo.'}
      </div>

      <main id="contenido" className="flex-1">
        <Outlet />
      </main>

      <SiteFooter />
      <ScrollRestoration />
    </div>
  )
}
