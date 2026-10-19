import { sectionHref } from '@/lib/paths'

const FOOTER_LINKS = [
  { id: 'seleccion', label: 'Selección' },
  { id: 'tienda', label: 'La tienda' },
  { id: 'como-funciona', label: 'Cómo funciona' },
] as const

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-stone-900/10">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid size-8 place-items-center rounded-[0.6rem] bg-ink text-[10px] font-semibold tracking-[0.02em] text-paper"
              >
                NM
              </span>
              <span className="text-[15px] font-medium tracking-tight">Norte Moda</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-stone-600">
              Ropa para el día a día, seleccionada en Caracas. Proyecto conceptual con datos
              ficticios.
            </p>
          </div>

          <nav aria-label="Pie de página">
            <ul className="flex flex-wrap gap-x-10 gap-y-2 text-sm">
              {FOOTER_LINKS.map((link) => (
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
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-stone-900/10 pt-6 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Norte Moda. Sin fines comerciales.</p>
          <p>React · TypeScript · Vite · Tailwind CSS</p>
        </div>
      </div>
    </footer>
  )
}
