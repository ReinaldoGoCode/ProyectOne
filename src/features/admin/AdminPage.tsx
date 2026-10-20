import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useCart } from '@/app/providers/cartContext'
import { useCatalog } from '@/app/providers/catalogContext'
import { useOrders } from '@/app/providers/orderContext'
import { buttonClassName } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

import { ProductAdmin } from './products/ProductAdmin'
import { OrderAdmin } from './orders/OrderAdmin'

export function AdminPage() {
  useDocumentTitle('Panel de administración · Norte Moda')
  const location = useLocation()
  const { resetCatalog } = useCatalog()
  const { reset: resetOrders } = useOrders()
  const { clear } = useCart()
  const [notice, setNotice] = useState('')
  const isOrders = location.pathname.endsWith('/pedidos')

  function resetDemo(): void {
    const confirmed = window.confirm(
      'Restaurar los datos ficticios eliminará los pedidos y cambios locales de este navegador. ¿Continuar?',
    )
    if (!confirmed) return
    resetCatalog()
    resetOrders()
    clear()
    setNotice('La tienda volvió a los datos ficticios iniciales.')
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
        Espacio de demostración
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-medium tracking-[-0.04em] sm:text-5xl">Administración</h1>
          <p className="mt-3 text-sm text-stone-600">Catálogo y pedidos de prueba de Norte Moda.</p>
        </div>
        <button type="button" onClick={resetDemo} className={buttonClassName('secondary')}>
          Restaurar datos de demo
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-900/10 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
        <strong>Modo local sin autenticación.</strong> Los cambios se guardan solo en el
        almacenamiento de este navegador. Usa datos ficticios; el panel no está protegido para
        producción ni conecta con pagos o envíos reales.
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-emerald-800">
        {notice}
      </p>

      <nav
        aria-label="Secciones de administración"
        className="mt-5 flex gap-2 border-b border-stone-900/10"
      >
        <Link
          to="/admin/productos"
          aria-current={!isOrders ? 'page' : undefined}
          className={`px-4 py-3 text-sm ${!isOrders ? 'border-b-2 border-ink font-medium' : 'text-stone-600'}`}
        >
          Productos
        </Link>
        <Link
          to="/admin/pedidos"
          aria-current={isOrders ? 'page' : undefined}
          className={`px-4 py-3 text-sm ${isOrders ? 'border-b-2 border-ink font-medium' : 'text-stone-600'}`}
        >
          Pedidos
        </Link>
      </nav>

      <div className="pt-7">{isOrders ? <OrderAdmin /> : <ProductAdmin />}</div>
    </section>
  )
}
