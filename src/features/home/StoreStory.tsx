import { seedCategories, seedProducts } from '@/data/seed'

export function StoreStory() {
  return (
    <section id="tienda" className="scroll-mt-24 border-t border-stone-900/6 bg-white/40">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
            La tienda
          </p>
          <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-balance sm:text-4xl">
            Menos inventario. Más criterio.
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-stone-600">
            Norte Moda nace de un comercio de barrio: pocas piezas, elegidas una por una, con el
            stock a la vista. Sin catálogos infinitos ni tallas fantasma.
          </p>
          <p className="mt-4 max-w-md text-base leading-relaxed text-stone-600">
            Cada prenda publicada trae su ficha, sus colores y sus tallas reales. Si algo no está,
            no se vende.
          </p>
        </div>

        <ul className="divide-y divide-stone-900/10 border-y border-stone-900/10">
          {seedCategories.map((category) => {
            const count = seedProducts.filter(
              (product) => product.active && product.categoryId === category.id,
            ).length

            return (
              <li key={category.id} className="flex items-baseline justify-between gap-6 py-5">
                <div>
                  <h3 className="text-base font-medium tracking-tight">{category.name}</h3>
                  <p className="mt-1 max-w-xs text-sm leading-relaxed text-stone-600">
                    {category.description}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-stone-500 tabular-nums">
                  {count} {count === 1 ? 'pieza' : 'piezas'}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
