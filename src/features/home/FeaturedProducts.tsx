import { Link } from 'react-router-dom'

import { useCatalog } from '@/app/providers/catalogContext'
import { ProductCard } from '@/components/ui/ProductCard'

export function FeaturedProducts() {
  const { catalog, catalogMode } = useCatalog()
  const featured = catalog.products.filter((product) => product.active).slice(0, 4)

  return (
    <section id="seleccion" className="scroll-mt-24 border-t border-stone-900/6">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
              Selección
            </p>
            <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
              Lo que se está llevando
            </h2>
          </div>
          <div className="sm:text-right">
            <p className="max-w-xs text-sm leading-relaxed text-stone-600">
              Una selección de las prendas publicadas en el catálogo actual.
            </p>
            <Link
              to="/catalogo"
              className="group mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink"
            >
              Ver todo el catálogo
              <span
                aria-hidden="true"
                className="transition-transform duration-300 ease-out group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
          {featured.map((product) => (
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
        {featured.length === 0 ? (
          <p
            role={catalogMode === 'loading' ? 'status' : undefined}
            className="mt-12 text-sm text-stone-500"
          >
            {catalogMode === 'loading'
              ? 'Cargando la selección…'
              : catalogMode === 'error'
                ? 'La selección no está disponible en este momento.'
                : 'Todavía no hay prendas publicadas.'}
          </p>
        ) : null}
      </div>
    </section>
  )
}
