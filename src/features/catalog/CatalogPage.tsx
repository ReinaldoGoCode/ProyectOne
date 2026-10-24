import { Link, useSearchParams } from 'react-router-dom'

import { ProductCard } from '@/components/ui/ProductCard'
import { buttonClassName } from '@/components/ui/button'
import { useCatalog } from '@/app/providers/catalogContext'
import {
  DEFAULT_CATALOG_SORT,
  countActiveProducts,
  countActiveProductsByCategory,
  filterCatalog,
  isCatalogSort,
} from '@/domain/catalog'
import type { CatalogSort } from '@/domain/catalog'
import type { Category } from '@/domain/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

import { CatalogControls } from './CatalogControls'

interface ParamUpdate {
  readonly categorySlug?: string | null
  readonly search?: string
  readonly sort?: CatalogSort
}

export function CatalogPage() {
  useDocumentTitle('Catálogo · Norte Moda')
  const { catalog, catalogMode, refreshCatalog } = useCatalog()
  const [searchParams, setSearchParams] = useSearchParams()

  const categorySlug = searchParams.get('categoria')
  const activeCategory: Category | null =
    catalog.categories.find((category) => category.slug === categorySlug) ?? null

  const search = searchParams.get('q') ?? ''
  const sortParam = searchParams.get('orden')
  const sort: CatalogSort = isCatalogSort(sortParam) ? sortParam : DEFAULT_CATALOG_SORT

  const products = filterCatalog(catalog, {
    categoryId: activeCategory?.id ?? null,
    search,
    sort,
  })

  const counts = countActiveProductsByCategory(catalog)
  const total = countActiveProducts(catalog)
  const trimmedSearch = search.trim()
  const count = products.length

  const resultLabel =
    trimmedSearch === ''
      ? `${String(count)} ${count === 1 ? 'pieza' : 'piezas'}`
      : `${String(count)} ${count === 1 ? 'resultado' : 'resultados'} para “${trimmedSearch}”`

  function updateParams(next: ParamUpdate): void {
    const params = new URLSearchParams(searchParams)

    if (next.categorySlug !== undefined) {
      if (next.categorySlug === null) {
        params.delete('categoria')
      } else {
        params.set('categoria', next.categorySlug)
      }
    }

    if (next.search !== undefined) {
      if (next.search === '') {
        params.delete('q')
      } else {
        params.set('q', next.search)
      }
    }

    if (next.sort !== undefined) {
      if (next.sort === DEFAULT_CATALOG_SORT) {
        params.delete('orden')
      } else {
        params.set('orden', next.sort)
      }
    }

    setSearchParams(params, { preventScrollReset: true, replace: true })
  }

  function hrefForCategory(slug: string | null): string {
    const params = new URLSearchParams()

    if (slug !== null) {
      params.set('categoria', slug)
    }

    if (search !== '') {
      params.set('q', search)
    }

    if (sort !== DEFAULT_CATALOG_SORT) {
      params.set('orden', sort)
    }

    const query = params.toString()
    return query === '' ? '/catalogo' : `/catalogo?${query}`
  }

  return (
    <>
      <section className="border-b border-stone-900/6">
        <div className="mx-auto w-full max-w-6xl px-5 pt-14 pb-8 sm:px-8 sm:pt-20 sm:pb-10">
          <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
            Catálogo
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-4xl font-medium tracking-[-0.04em] text-balance sm:text-5xl">
              Toda la colección
            </h1>
            <p className="text-sm text-stone-500">Temporada 2026 · Caracas</p>
          </div>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-stone-600">
            Prendas disponibles esta temporada, con sus tallas y colores reales. Filtra por
            categoría o busca por nombre.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <CatalogControls
          categories={catalog.categories}
          activeCategoryId={activeCategory?.id ?? null}
          counts={counts}
          total={total}
          search={search}
          sort={sort}
          hrefForCategory={hrefForCategory}
          onSearchChange={(value) => {
            updateParams({ search: value })
          }}
          onSortChange={(value) => {
            updateParams({ sort: value })
          }}
        />

        <p aria-live="polite" className="mt-6 text-sm text-stone-500">
          {resultLabel}
        </p>

        {products.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                variants={catalog.variants}
                categoryName={
                  catalog.categories.find((category) => category.id === product.categoryId)?.name ??
                  'Norte Moda'
                }
              />
            ))}
          </div>
        ) : catalogMode === 'loading' ? (
          <p role="status" className="mt-16 mb-10 text-center text-sm text-stone-600">
            Cargando prendas…
          </p>
        ) : catalogMode === 'error' ? (
          <div role="alert" className="mt-16 mb-10 flex flex-col items-center text-center">
            <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
              Catálogo no disponible
            </p>
            <h2 className="mt-3 text-2xl font-medium tracking-[-0.02em] text-balance">
              No pudimos cargar las prendas.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-stone-600">
              Comprueba tu conexión e inténtalo de nuevo.
            </p>
            <button
              type="button"
              className={buttonClassName('secondary', 'mt-7')}
              onClick={() => void refreshCatalog()}
            >
              Reintentar
            </button>
          </div>
        ) : catalogMode === 'connected' && total === 0 ? (
          <div className="mt-16 mb-10 flex flex-col items-center text-center">
            <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
              Catálogo vacío
            </p>
            <h2 className="mt-3 text-2xl font-medium tracking-[-0.02em] text-balance">
              Todavía no hay prendas publicadas.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-stone-600">
              El catálogo se administra desde el panel de Norte Moda.
            </p>
            <Link to="/admin" className={buttonClassName('secondary', 'mt-7')}>
              Abrir administración
            </Link>
          </div>
        ) : (
          <div className="mt-16 mb-10 flex flex-col items-center text-center">
            <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
              Sin resultados
            </p>
            <h2 className="mt-3 text-2xl font-medium tracking-[-0.02em] text-balance">
              No encontramos esa prenda.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-stone-600">
              Prueba con otra palabra o quita los filtros para ver la colección completa.
            </p>
            <Link to="/catalogo" className={buttonClassName('secondary', 'mt-7')}>
              Limpiar filtros
            </Link>
          </div>
        )}
      </section>
    </>
  )
}
