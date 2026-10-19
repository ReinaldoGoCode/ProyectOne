import { formatMoney } from '@/domain/money'
import { getTotalStock, listColors } from '@/domain/product'
import type { Product, Variant } from '@/domain/types'
import { colorToHex } from '@/lib/colors'

import { GarmentArt } from './GarmentArt'

interface ProductCardProps {
  readonly product: Product
  readonly variants: readonly Variant[]
  readonly categoryName: string
}

/**
 * Tarjeta presentacional de producto. En esta sesión no navega a ninguna
 * parte: la ficha de producto llega en la sesión 5 y ahí se convierte en
 * enlace. Por eso no usa cursor de mano ni estados que prometan un clic.
 */
export function ProductCard({ product, variants, categoryName }: ProductCardProps) {
  const colors = listColors(variants, product.id)
  const isSoldOut = getTotalStock(variants, product.id) === 0

  return (
    <article className="group">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-sand ring-1 ring-stone-900/5">
        <div className="aspect-[4/5] p-6 sm:p-8">
          <GarmentArt
            categoryId={product.categoryId}
            color={colors[0] ?? 'Arena'}
            className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        </div>

        {isSoldOut ? (
          <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium tracking-[0.12em] text-stone-600 uppercase backdrop-blur">
            Agotado
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.14em] text-stone-500 uppercase">{categoryName}</p>
          <h3 className="mt-1 text-[15px] font-medium tracking-tight">{product.name}</h3>
        </div>
        <p className="shrink-0 text-[15px] font-medium tabular-nums">
          {formatMoney(product.priceCents)}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="flex -space-x-1" aria-hidden="true">
          {colors.slice(0, 4).map((color) => (
            <span
              key={color}
              className="size-3.5 rounded-full ring-2 ring-paper"
              style={{ backgroundColor: colorToHex(color) }}
            />
          ))}
        </span>
        <span className="text-xs text-stone-500">
          {colors.length} {colors.length === 1 ? 'color' : 'colores'}
        </span>
      </div>
    </article>
  )
}
