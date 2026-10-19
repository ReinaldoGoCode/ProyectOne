import { Outlet, ScrollRestoration } from 'react-router-dom'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'

export function StoreLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
      >
        Saltar al contenido
      </a>

      <SiteHeader />

      <main id="contenido" className="flex-1">
        <Outlet />
      </main>

      <SiteFooter />
      <ScrollRestoration />
    </div>
  )
}
