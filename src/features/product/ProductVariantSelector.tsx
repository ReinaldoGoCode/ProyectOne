import { colorToHex, isLightColor } from '@/lib/colors'
import type { Size } from '@/domain/types'

interface ProductVariantSelectorProps {
  readonly sizes: readonly Size[]
  readonly colors: readonly string[]
  readonly selectedSize: Size | null
  readonly selectedColor: string | null
  readonly availableSizes: readonly Size[]
  readonly availableColors: ReadonlySet<string>
  readonly onSelectSize: (size: Size) => void
  readonly onSelectColor: (color: string) => void
}

function CheckIcon({ light }: { readonly light: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-3.5 ${light ? 'text-ink' : 'text-paper'}`}
    >
      <path d="m3 8.5 3 3 7-7" />
    </svg>
  )
}

export function ProductVariantSelector({
  sizes,
  colors,
  selectedSize,
  selectedColor,
  availableSizes,
  availableColors,
  onSelectSize,
  onSelectColor,
}: ProductVariantSelectorProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[11px] tracking-[0.16em] text-stone-500 uppercase">Color</p>
        <p className="text-sm font-medium">{selectedColor ?? 'Agotado'}</p>
      </div>

      <div role="group" aria-label="Elegir color" className="mt-3 flex flex-wrap gap-2">
        {colors.map((color) => {
          const enabled = availableColors.has(color)
          const selected = selectedColor === color

          return (
            <button
              key={color}
              type="button"
              disabled={!enabled}
              aria-pressed={selected}
              aria-label={enabled ? `Color ${color}` : `Color ${color} (agotado)`}
              onClick={() => {
                onSelectColor(color)
              }}
              className={`grid size-11 place-items-center rounded-full transition-[transform,opacity] duration-200 ease-out ${
                enabled ? 'active:scale-95' : 'cursor-not-allowed opacity-35'
              } ${selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''}`}
            >
              <span
                className="grid size-8 place-items-center rounded-full border border-stone-900/10"
                style={{ backgroundColor: colorToHex(color) }}
              >
                {selected ? <CheckIcon light={isLightColor(color)} /> : null}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-7 flex items-baseline justify-between gap-4">
        <p className="text-[11px] tracking-[0.16em] text-stone-500 uppercase">Talla</p>
        <p className="text-sm font-medium">{selectedSize ?? 'Agotado'}</p>
      </div>

      <div role="group" aria-label="Elegir talla" className="mt-3 flex flex-wrap gap-2">
        {sizes.map((size) => {
          const enabled = availableSizes.includes(size)
          const selected = selectedSize === size

          return (
            <button
              key={size}
              type="button"
              disabled={!enabled}
              aria-pressed={selected}
              aria-label={enabled ? `Talla ${size}` : `Talla ${size} (agotada)`}
              onClick={() => {
                onSelectSize(size)
              }}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3.5 text-sm transition-[background-color,color,box-shadow,transform] duration-200 ease-out ${
                selected
                  ? 'bg-ink text-paper'
                  : enabled
                    ? 'text-stone-700 ring-1 ring-stone-900/10 hover:bg-white hover:text-ink hover:ring-stone-900/20 active:scale-[0.97]'
                    : 'cursor-not-allowed text-stone-400 line-through ring-1 ring-stone-900/5'
              }`}
            >
              {size}
            </button>
          )
        })}
      </div>
    </div>
  )
}
