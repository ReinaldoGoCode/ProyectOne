import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { requestRemotePaymentOptions } from '@/data/repositories/remoteOrderGateway'
import type { RemoteStorePaymentOption } from '@/data/repositories/remoteOrderGateway'
import { STORE_PROFILE } from '@/data/storeProfile'
import { sectionHref } from '@/lib/paths'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { STORE_WHATSAPP_NUMBER } from '@/lib/whatsapp'

const SECTION_LINKS = [
  { id: 'seleccion', label: 'Selección' },
  { id: 'tienda', label: 'La tienda' },
  { id: 'como-funciona', label: 'Cómo funciona' },
] as const

export function SiteFooter() {
  const year = new Date().getFullYear()
  const [paymentOptions, setPaymentOptions] = useState<readonly RemoteStorePaymentOption[]>([])
  const [paymentState, setPaymentState] = useState<
    'demo' | 'loading' | 'connected' | 'unavailable'
  >(getSupabaseBrowserClient() ? 'loading' : 'demo')

  useEffect(() => {
    if (!getSupabaseBrowserClient()) return
    let mounted = true
    void requestRemotePaymentOptions()
      .then((options) => {
        if (mounted) {
          setPaymentOptions(options)
          setPaymentState('connected')
        }
      })
      .catch(() => {
        if (mounted) setPaymentState('unavailable')
      })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <footer className="border-t border-stone-900/10">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid size-8 place-items-center rounded-[0.6rem] bg-ink text-[10px] font-semibold tracking-[0.02em] text-paper"
              >
                NM
              </span>
              <span className="text-[15px] font-medium tracking-tight">{STORE_PROFILE.name}</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-stone-600">
              {STORE_PROFILE.description}
            </p>
          </div>

          <nav aria-label="Secciones de la tienda">
            <h2 className="text-xs font-semibold tracking-[0.16em] text-stone-500 uppercase">
              Comprar
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  to="/catalogo"
                  className="inline-block text-stone-600 transition-colors duration-200 hover:text-ink"
                >
                  Catálogo
                </Link>
              </li>
              <li>
                <Link to="/pedido" className="text-stone-600 hover:text-ink">
                  Consultar pedido
                </Link>
              </li>
              {SECTION_LINKS.map((link) => (
                <li key={link.id}>
                  <a
                    href={sectionHref(link.id)}
                    className="text-stone-600 transition-colors duration-200 hover:text-ink"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <section aria-labelledby="footer-contact-title">
            <h2
              id="footer-contact-title"
              className="text-xs font-semibold tracking-[0.16em] text-stone-500 uppercase"
            >
              Contacto
            </h2>
            {STORE_WHATSAPP_NUMBER || STORE_PROFILE.supportEmail ? (
              <ul className="mt-3 space-y-2 text-sm">
                {STORE_WHATSAPP_NUMBER ? (
                  <li>
                    <a
                      href={`https://wa.me/${STORE_WHATSAPP_NUMBER}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-stone-600 hover:text-ink"
                    >
                      WhatsApp
                    </a>
                  </li>
                ) : null}
                {STORE_PROFILE.supportEmail ? (
                  <li>
                    <a
                      href={`mailto:${STORE_PROFILE.supportEmail}`}
                      className="text-stone-600 hover:text-ink"
                    >
                      {STORE_PROFILE.supportEmail}
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-stone-500">
                Los datos de contacto no están configurados.
              </p>
            )}
            {STORE_PROFILE.socialLinks.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {STORE_PROFILE.socialLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-stone-600 hover:text-ink"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section aria-labelledby="footer-payment-title">
            <h2
              id="footer-payment-title"
              className="text-xs font-semibold tracking-[0.16em] text-stone-500 uppercase"
            >
              Pagos y políticas
            </h2>
            {paymentState === 'demo' ? (
              <p className="mt-3 text-sm leading-relaxed text-stone-500">
                Modo demo local: no se procesan pagos.
              </p>
            ) : paymentState === 'loading' ? (
              <p role="status" className="mt-3 text-sm text-stone-500">
                Consultando métodos configurados…
              </p>
            ) : paymentState === 'connected' && paymentOptions.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {paymentOptions.map((option) => (
                  <li
                    key={option.method}
                    className="rounded-full bg-paper px-3 py-1.5 text-xs text-stone-700"
                  >
                    {option.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-stone-500">No hay métodos de pago habilitados.</p>
            )}
            {STORE_PROFILE.policyLinks.length ? (
              <ul className="mt-4 space-y-2 text-sm">
                {STORE_PROFILE.policyLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="text-stone-600 hover:text-ink">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-stone-500">
                Las políticas se publicarán cuando el negocio confirme sus condiciones.
              </p>
            )}
          </section>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-stone-900/10 pt-6 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {STORE_PROFILE.name}. Proyecto de demostración, sin fines comerciales.
          </p>
          <p>Seguimiento disponible desde la consulta de pedido.</p>
        </div>
      </div>
    </footer>
  )
}
