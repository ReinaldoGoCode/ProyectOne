import { describe, expect, it } from 'vitest'

import { BASE_PATH, publicAssetHref, sectionHref } from '../paths'

describe('rutas y assets públicos', () => {
  it('mantiene el prefijo de GitHub Pages en assets locales', () => {
    expect(publicAssetHref('/images/products/placeholder.svg')).toBe(
      `${BASE_PATH}images/products/placeholder.svg`,
    )
  })

  it('no altera imágenes del bucket público de Supabase', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/product-images/a.webp'
    expect(publicAssetHref(url)).toBe(url)
  })

  it('conserva el prefijo al volver a una sección desde otra ruta', () => {
    expect(sectionHref('tienda')).toBe(`${BASE_PATH}#tienda`)
  })
})
