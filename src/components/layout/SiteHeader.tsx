import { useState } from 'react'
import { Link } from 'react-router-dom'

import { sectionHref } from '@/lib/paths'

const NAV_LINKS = [
  { id: 'seleccion', label: 'Selección' },
  { id: 'tienda', label: 'La tienda' },
  { id: 'como-funciona', label: 'Cómo funciona' },
] as const

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-stone-900/6 bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:h-18 sm:px-8">
        <Link
          to="/"
          onClick={() => {
            setMenuOpen(false)
          }}
          className="group flex items-center gap-2.5"
          aria-label="Norte Moda, ir al inicio"
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-[0.6rem] bg-ink text-[10px] font-semibold tracking-[0.02em] text-paper transition-transform duration-300 ease-out group-hover:-rotate-6"
          >
            NM
          </span>
          <span className="text-[15px] font-medium tracking-tight">Norte Moda</span>
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-8 sm:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={sectionHref(link.id)}
              className="group relative text-[13px] text-stone-600 transition-colors duration-200 hover:text-ink"
            >
              {link.label}
              <span
                aria-hidden="true"
                className="absolute -bottom-1.5 left-0 h-px w-full origin-left scale-x-0 bg-ink transition-transform duration-300 ease-out group-hover:scale-x-100"
              />
            </a>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => {
            setMenuOpen((open) => !open)
          }}
          aria-expanded={menuOpen}
          aria-controls="menu-movil"
          className="relative grid size-10 place-items-center rounded-full ring-1 ring-stone-900/10 transition-colors duration-200 hover:bg-white sm:hidden"
        >
          <span className="sr-only">{menuOpen ? 'Cerrar menú' : 'Abrir menú'}</span>
          <span
            aria-hidden="true"
            className={`absolute h-px w-4 bg-ink transition-transform duration-300 ease-out ${
              menuOpen ? 'rotate-45' : '-translate-y-[3px]'
            }`}
          />
          <span
            aria-hidden="true"
            className={`absolute h-px w-4 bg-ink transition-transform duration-300 ease-out ${
              menuOpen ? '-rotate-45' : 'translate-y-[3px]'
            }`}
          />
        </button>
      </div>

      <div
        id="menu-movil"
        hidden={!menuOpen}
        className="border-t border-stone-900/6 bg-paper/95 px-5 backdrop-blur-xl sm:hidden"
      >
        <nav aria-label="Principal móvil">
          <ul className="divide-y divide-stone-900/6">
            {NAV_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={sectionHref(link.id)}
                  onClick={() => {
                    setMenuOpen(false)
                  }}
                  className="block py-3.5 text-sm text-stone-700 transition-colors active:text-ink"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
