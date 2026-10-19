import type { CategoryId } from '@/domain/types'
import { colorToHex, isLightColor } from '@/lib/colors'

interface GarmentArtProps {
  readonly categoryId: CategoryId
  readonly color: string
  readonly className?: string
}

const SHIRT =
  'M78 74 L104 60 C112 78 128 78 136 60 L162 74 L196 112 L172 136 L158 120 L158 236 C138 242 102 242 82 236 L82 120 L68 136 L44 112 Z'

const DRESS =
  'M92 62 L106 52 C112 68 128 68 134 52 L148 62 L156 118 L186 244 C154 254 86 254 54 244 L84 118 Z'

const PANTS = 'M82 62 L158 62 L166 246 L132 246 L120 132 L108 246 L74 246 Z'

function garmentPath(categoryId: CategoryId): string {
  switch (categoryId) {
    case 'vestidos':
      return DRESS
    case 'pantalones':
      return PANTS
    default:
      return SHIRT
  }
}

/** Costuras mínimas que ayudan a leer la prenda sin recargar el dibujo. */
function garmentDetail(categoryId: CategoryId): string {
  switch (categoryId) {
    case 'vestidos':
      return 'M88 122 H152'
    case 'pantalones':
      return 'M84 84 H156 M120 84 V130'
    default:
      return 'M120 82 V232'
  }
}

/**
 * Silueta de la prenda dibujada con SVG. Sustituye a la fotografía en la v1:
 * no depende de la red, no pesa y toma el color real de la variante.
 * Es decorativa, porque el nombre del producto ya está en el texto.
 */
export function GarmentArt({ categoryId, color, className }: GarmentArtProps) {
  const fill = colorToHex(color)
  const stroke = isLightColor(color) ? 'rgba(28, 25, 23, 0.16)' : 'rgba(28, 25, 23, 0.08)'
  const detailStroke = isLightColor(color) ? 'rgba(28, 25, 23, 0.22)' : 'rgba(255, 255, 255, 0.38)'

  return (
    <svg viewBox="0 0 240 280" aria-hidden="true" className={className} fill="none">
      <ellipse cx="120" cy="264" rx="54" ry="5" fill="rgba(28, 25, 23, 0.07)" />
      <path
        d={garmentPath(categoryId)}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d={garmentDetail(categoryId)}
        stroke={detailStroke}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  )
}
