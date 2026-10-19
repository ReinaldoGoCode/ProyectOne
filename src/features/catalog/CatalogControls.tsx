import { Link } from 'react-router-dom'

import { isCatalogSort } from '@/domain/catalog'
import type { CatalogSort } from '@/domain/catalog'
import type { Category, CategoryId } from '@/domain/types'

const SORT_OPTIONS: readonly { readonly value: CatalogSort; readonly label: string }[] = [
  { value: 'novedades', label: 'Novedades' },
  { value: 'precio-asc', label: 'Precio: menor a mayor' },
  { value: 'precio-desc', label: 'Precio: mayor a menor' },
]

interface CatalogControlsProps {
  readonly categories: readonly Category[]
  readonly activeCategoryId: CategoryId | null
  readonly counts: ReadonlyMap<CategoryId, number>
  readonly total: number
  readonly search: string
  readonly sort: CatalogSort
  readonly hrefForCategory: (slug: string | null) => string
  readonly onSearchChange: (value: string) => void
  readonly onSortChange: (sort: CatalogSort) => void
}

function pillClassName(active: boolean): string {
  return [
    'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.98]',
    active
      ? 'bg-ink text-paper'
      : 'text-stone-600 ring-1 ring-stone-900/10 hover:bg-white hover:text-ink hover:ring-stone-900/20',
  ].join(' ')
}

export function CatalogControls({
  categories,
  activeCategoryId,
  counts,
  total,
  search,
  sort,
  hrefForCategory,
  onSearchChange,
  onSortChange,
}: CatalogControlsProps) {
  return (
    <div className="flex flex-col gap-6 border-b border-stone-900/10 pb-6">
      <nav aria-label="Filtrar por categoría" className="relative">
        <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
          <li>
            <Link
              to={hrefForCategory(null)}
              preventScrollReset
              aria-current={activeCategoryId === null ? 'page' : undefined}
              className={pillClassName(activeCategoryId === null)}
            >
              Todas
              <span className="text-[11px] tabular-nums opacity-60">{total}</span>
            </Link>
          </li>
          {categories.map((category) => {
            const active = activeCategoryId === category.id

            return (
              <li key={category.id}>
                <Link
                  to={hrefForCategory(category.slug)}
                  preventScrollReset
                  aria-current={active ? 'page' : undefined}
                  className={pillClassName(active)}
                >
                  {category.name}
                  <span className="text-[11px] tabular-nums opacity-60">
                    {counts.get(category.id) ?? 0}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-paper to-transparent sm:hidden"
        />
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <label htmlFor="buscar-prendas" className="sr-only">
            Buscar prendas
          </label>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-stone-400"
          >
            <circle cx="9" cy="9" r="5.5" />
            <path d="m13.2 13.2 3.3 3.3" strokeLinecap="round" />
          </svg>
          <input
            id="buscar-prendas"
            type="search"
            value={search}
            onChange={(event) => {
              onSearchChange(event.target.value)
            }}
            placeholder="Buscar por prenda o color"
            autoComplete="off"
            enterKeyHint="search"
            className="h-11 w-full rounded-full bg-white/60 pr-10 pl-10 text-sm ring-1 ring-stone-900/10 transition-[background-color,box-shadow] duration-200 outline-none placeholder:text-stone-500 focus:bg-white focus:ring-2 focus:ring-ink/20 sm:w-72 [&::-webkit-search-cancel-button]:hidden"
          />
          {search.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange('')
              }}
              aria-label="Limpiar búsqueda"
              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-stone-500 transition-colors duration-200 hover:bg-stone-900/5 hover:text-ink"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="size-3.5"
              >
                <path d="m4 4 8 8M12 4l-8 8" />
              </svg>
            </button>
          ) : null}
        </div>

        <div className="relative">
          <label htmlFor="ordenar-catalogo" className="sr-only">
            Ordenar por
          </label>
          <select
            id="ordenar-catalogo"
            value={sort}
            onChange={(event) => {
              if (isCatalogSort(event.target.value)) {
                onSortChange(event.target.value)
              }
            }}
            className="h-11 w-full appearance-none rounded-full bg-white/60 pr-10 pl-4 text-sm ring-1 ring-stone-900/10 transition-[background-color,box-shadow] duration-200 outline-none focus:bg-white focus:ring-2 focus:ring-ink/20 sm:w-auto"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="pointer-events-none absolute top-1/2 right-4 size-3 -translate-y-1/2 text-stone-500"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </div>
      </div>
    </div>
  )
}
