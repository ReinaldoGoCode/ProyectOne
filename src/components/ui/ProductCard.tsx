import { Link } from 'react-router-dom'

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
 * Tarjeta de producto enlazada a su ficha. El enlace envuelve la tarjeta
 * completa para que el área de clic coincida con lo que se ve.
 */
export function ProductCard({ product, variants, categoryName }: ProductCardProps) {
  const colors = listColors(variants, product.id)
  const isSoldOut = getTotalStock(variants, product.id) === 0

  return (
    <Link to={`/producto/${product.slug}`} className="group block">
      <article className="min-w-0">
        <div className="relative overflow-hidden rounded-[1.25rem] bg-sand ring-1 ring-stone-900/5 sm:rounded-[1.75rem]">
          <div className="aspect-[4/5] p-4 sm:p-6">
            <GarmentArt
              categoryId={product.categoryId}
              color={colors[0] ?? 'Arena'}
              className="h-full w-full drop-shadow-[0_14px_18px_rgba(28,25,23,0.12)] transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          </div>

          {isSoldOut ? (
            <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium tracking-[0.1em] text-stone-600 uppercase backdrop-blur sm:top-4 sm:left-4">
              Agotado
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.14em] text-stone-500 uppercase">{categoryName}</p>
            <h3 className="mt-1 text-[13px] leading-snug font-medium tracking-tight group-hover:underline group-hover:underline-offset-4 sm:text-[15px]">
              {product.name}
            </h3>
          </div>
          <p className="shrink-0 text-[13px] font-medium tabular-nums sm:text-[15px]">
            {formatMoney(product.priceCents)}
          </p>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <span className="flex -space-x-1" aria-hidden="true">
            {colors.slice(0, 4).map((color) => (
              <span
                key={color}
                className="size-3 rounded-full ring-2 ring-paper sm:size-3.5"
                style={{ backgroundColor: colorToHex(color) }}
              />
            ))}
          </span>
          <span className="text-[11px] text-stone-500 sm:text-xs">
            {colors.length} {colors.length === 1 ? 'color' : 'colores'}
          </span>
        </div>
      </article>
    </Link>
  )
}
