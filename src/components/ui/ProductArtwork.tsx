import { useState } from 'react'

import { GarmentArt } from '@/components/ui/GarmentArt'
import type { CategoryId } from '@/domain/types'
import { publicAssetHref } from '@/lib/paths'

interface ProductArtworkProps {
  readonly imageUrl: string
  readonly imageAlt: string
  readonly productName: string
  readonly categoryId: CategoryId
  readonly color: string
  readonly className?: string
  readonly loading?: 'eager' | 'lazy'
}

/** Shows the catalog image when available, with the existing SVG as fallback. */
export function ProductArtwork({
  imageUrl,
  imageAlt,
  productName,
  categoryId,
  color,
  className = '',
  loading = 'lazy',
}: ProductArtworkProps) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <div className={`relative ${className}`}>
      <GarmentArt
        categoryId={categoryId}
        color={color}
        className="absolute inset-0 h-full w-full"
      />
      {imageUrl && !imageFailed ? (
        <img
          src={publicAssetHref(imageUrl)}
          alt={imageAlt.trim() || productName}
          loading={loading}
          decoding="async"
          onError={() => {
            setImageFailed(true)
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </div>
  )
}
