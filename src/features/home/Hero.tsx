import { GarmentArt } from '@/components/ui/GarmentArt'
import { buttonClassName } from '@/components/ui/button'
import { seedCategories, seedProducts } from '@/data/seed'
import { formatMoney } from '@/domain/money'
import { sectionHref } from '@/lib/paths'

/**
 * Portada. La pieza destacada sale del seed para que el precio y el nombre
 * que se muestran sean los mismos que luego verá el catálogo.
 */
export function Hero() {
  const heroProduct = seedProducts.find((product) => product.slug === 'camisa-lino-margarita')
  const activeCount = seedProducts.filter((product) => product.active).length

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
            <a href={sectionHref('seleccion')} className={buttonClassName()}>
              Ver la selección
            </a>
            <a href={sectionHref('tienda')} className={buttonClassName('secondary')}>
              Conocer la tienda
            </a>
          </div>

          <dl className="animate-rise mt-14 flex max-w-md gap-10 border-t border-stone-900/10 pt-6 [animation-delay:240ms]">
            <div>
              <dt className="text-[11px] tracking-[0.14em] text-stone-500 uppercase">Piezas</dt>
              <dd className="mt-1 text-xl font-medium tabular-nums">{activeCount}</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-[0.14em] text-stone-500 uppercase">Categorías</dt>
              <dd className="mt-1 text-xl font-medium tabular-nums">{seedCategories.length}</dd>
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
              <GarmentArt
                categoryId="camisas"
                color="Terracota"
                className="h-full w-full drop-shadow-[0_30px_40px_rgba(92,49,34,0.16)]"
              />
            </div>
          </div>

          {heroProduct ? (
            <div className="absolute inset-x-6 -bottom-1 rounded-2xl bg-white/85 p-4 shadow-[0_24px_60px_-30px_rgba(28,25,23,0.45)] ring-1 ring-stone-900/5 backdrop-blur-md sm:inset-x-10">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] tracking-[0.16em] text-stone-500 uppercase">
                    Camisa de lino
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium">Margarita · Terracota</p>
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
