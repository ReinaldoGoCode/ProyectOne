import { useParams } from 'react-router-dom'

import { useCatalog } from '@/app/providers/catalogContext'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

import { ProductDetail } from './ProductDetail'

export function ProductPage() {
  const { catalog, catalogMode } = useCatalog()
  const { slug } = useParams<{ slug: string }>()
  const product = catalog.products.find((item) => item.slug === slug && item.active)

  useDocumentTitle(
    product
      ? `${product.name} · Norte Moda`
      : catalogMode === 'loading'
        ? 'Cargando prenda · Norte Moda'
        : 'Producto no encontrado · Norte Moda',
  )

  if (!product) {
    if (catalogMode === 'loading') {
      return (
        <p
          role="status"
          className="mx-auto max-w-3xl px-5 py-24 text-center text-sm text-stone-600"
        >
          Cargando esta prenda…
        </p>
      )
    }
    return <NotFoundPage />
  }

  return <ProductDetail product={product} catalog={catalog} />
}
