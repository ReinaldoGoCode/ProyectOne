import { Link } from 'react-router-dom'

import { useCatalog } from '@/app/providers/catalogContext'
import { ProductArtwork } from '@/components/ui/ProductArtwork'
import { buttonClassName } from '@/components/ui/button'
import { formatMoney } from '@/domain/money'
import { listColors } from '@/domain/product'
import { sectionHref } from '@/lib/paths'

/**
 * Portada basada en el catálogo cargado por el proveedor activo.
 */
export function Hero() {
  const { catalog, catalogMode } = useCatalog()
  const heroProduct = catalog.products.find((product) => product.active)
  const heroCategory = heroProduct
    ? catalog.categories.find((category) => category.id === heroProduct.categoryId)
    : null
  const heroColor = heroProduct
    ? (listColors(catalog.variants, heroProduct.id)[0] ?? 'Terracota')
    : 'Terracota'
  const activeCount = catalog.products.filter((product) => product.active).length

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[34rem] w-[64rem] -translate-x-1/2 rounded-full bg-brand-100/60 blur-3xl"
      />

      <div className="relative mx-auto grid w-full max-w-6xl gap-16 px-5 pt-14 pb-20 sm:px-8 sm:pt-20 sm:pb-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20">
        <div>
          <p className="animate-rise text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
            Colección 2026 · Caracas
          </p>

          <h1 className="animate-rise mt-6 text-[clamp(2.9rem,7.2vw,5.4rem)] leading-[0.94] font-medium tracking-[-0.045em] text-balance [animation-delay:60ms]">
            Pocas prendas.
            <br />
            <span className="text-brand-700">Bien hechas.</span>
          </h1>

          <p className="animate-rise mt-7 max-w-md text-lg leading-relaxed text-stone-600 [animation-delay:120ms]">
            Lino, algodón y viscosa para el calor. Una selección corta, con tallas y colores que sí
            existen en el perchero.
          </p>

          <div className="animate-rise mt-9 flex flex-wrap items-center gap-3 [animation-delay:180ms]">
            <Link to="/catalogo" className={buttonClassName()}>
              Ver el catálogo
            </Link>
            <a href={sectionHref('tienda')} className={buttonClassName('secondary')}>
              Conocer la tienda
            </a>
          </div>

          <dl className="animate-rise mt-14 flex max-w-md gap-10 border-t border-stone-900/10 pt-6 [animation-delay:240ms]">
            <div>
              <dt className="text-[11px] tracking-[0.14em] text-stone-500 uppercase">Piezas</dt>
              <dd className="mt-1 text-xl font-medium tabular-nums">
                {catalogMode === 'loading' ? '…' : activeCount}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-[0.14em] text-stone-500 uppercase">Categorías</dt>
              <dd className="mt-1 text-xl font-medium tabular-nums">
                {catalogMode === 'loading' ? '…' : catalog.categories.length}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-[0.14em] text-stone-500 uppercase">Tallas</dt>
              <dd className="mt-1 text-xl font-medium">XS–XL</dd>
            </div>
          </dl>
        </div>

        <div className="animate-fade relative mx-auto w-full max-w-sm pb-8 [animation-delay:200ms] lg:max-w-md">
          <div className="overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-brand-100 via-brand-50 to-sand p-7 ring-1 ring-stone-900/5 sm:p-9">
            <div className="aspect-[4/5]">
              <ProductArtwork
                imageUrl={heroProduct?.imageUrl ?? ''}
                imageAlt={heroProduct?.imageAlt ?? ''}
                productName={heroProduct?.name ?? 'Prenda destacada'}
                categoryId={heroProduct?.categoryId ?? 'camisas'}
                color={heroColor}
                className="h-full w-full drop-shadow-[0_30px_40px_rgba(92,49,34,0.16)]"
                loading="eager"
              />
            </div>
          </div>

          {heroProduct ? (
            <div className="absolute inset-x-6 -bottom-1 rounded-2xl bg-white/85 p-4 shadow-[0_24px_60px_-30px_rgba(28,25,23,0.45)] ring-1 ring-stone-900/5 backdrop-blur-md sm:inset-x-10">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] tracking-[0.16em] text-stone-500 uppercase">
                    {heroCategory?.name ?? 'Selección'}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium">
                    {heroProduct.name} · {heroColor}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-medium tabular-nums">
                  {formatMoney(heroProduct.priceCents)}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
