import { Link } from 'react-router-dom'

import { ProductCard } from '@/components/ui/ProductCard'
import { seedCategories, seedProducts, seedVariants } from '@/data/seed'
import type { CategoryId, Product } from '@/domain/types'

/**
 * Selección editorial de la portada. Es una lista curada, no "los primeros
 * cuatro": en una tienda pequeña la portada la decide quien compra.
 */
const FEATURED_SLUGS = [
  'camisa-lino-margarita',
  'vestido-corto-paraguana',
  'pantalon-cargo-caracas',
  'jean-recto-maracaibo',
] as const

function findProduct(slug: string): Product | undefined {
  return seedProducts.find((product) => product.slug === slug)
}

function categoryName(categoryId: CategoryId): string {
  return seedCategories.find((category) => category.id === categoryId)?.name ?? 'Norte Moda'
}

export function FeaturedProducts() {
  const featured = FEATURED_SLUGS.map(findProduct).filter(
    (product): product is Product => product !== undefined,
  )

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
              Cuatro piezas de la temporada, elegidas por su tela y su caída.
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
              variants={seedVariants}
              categoryName={categoryName(product.categoryId)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
