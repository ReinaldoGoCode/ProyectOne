import { Outlet, ScrollRestoration } from 'react-router-dom'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { useCatalog } from '@/app/providers/catalogContext'
import { ExchangeRateProvider } from '@/app/providers/ExchangeRateProvider'
import { useExchangeRate } from '@/app/providers/exchangeRateContext'
import { BCV_OFFICIAL_SOURCE_URL } from '@/domain/exchangeRate'

export function StoreLayout() {
  return (
    <ExchangeRateProvider>
      <StoreLayoutContent />
    </ExchangeRateProvider>
  )
}

function StoreLayoutContent() {
  const { catalogMode } = useCatalog()
  const { rate, warning, loading } = useExchangeRate()
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
        {catalogMode === 'demo' ? (
          'Demo local · pedidos e inventario quedan guardados solo en este navegador.'
        ) : catalogMode === 'loading' ? (
          'Conectando con el catálogo remoto…'
        ) : catalogMode === 'error' ? (
          'No se pudo leer el catálogo remoto. Se ocultó el catálogo local para evitar mostrar datos como si fueran del servidor.'
        ) : rate ? (
          <>
            1 USD = {rate.vesPerUsd} Bs. · tasa BCV vigente desde {rate.effectiveDate} · consultada
            por la tienda el{' '}
            {new Date(rate.retrievedAt).toLocaleString('es-VE', {
              timeZone: 'America/Caracas',
              dateStyle: 'short',
              timeStyle: 'short',
            })}{' '}
            · feed{' '}
            <a
              href={rate.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              DolarVZLA
            </a>
            {' · datos publicados como BCV; compara la vigencia con el '}
            <a
              href={BCV_OFFICIAL_SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              portal oficial
            </a>
            .
            {rate.isStale || rate.warning || warning ? (
              <span className="ml-1 font-semibold">
                Advertencia: se muestra la última tasa validada; confirma su vigencia antes de
                pagar.
              </span>
            ) : null}
          </>
        ) : loading ? (
          'Catálogo conectado · consultando la tasa BCV…'
        ) : (
          <>
            No hay una tasa BCV validada disponible; los precios se muestran solo en USD.{' '}
            {warning ? <span>{warning}</span> : null}
          </>
        )}
      </div>

      <main id="contenido" className="flex-1">
        <Outlet />
      </main>

      <SiteFooter />
      <ScrollRestoration />
    </div>
  )
}
