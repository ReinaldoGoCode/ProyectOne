import { useParams } from 'react-router-dom'

import { useCatalog } from '@/app/providers/catalogContext'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

import { ProductDetail } from './ProductDetail'

export function ProductPage() {
  const { catalog } = useCatalog()
  const { slug } = useParams<{ slug: string }>()
  const product = catalog.products.find((item) => item.slug === slug && item.active)

  useDocumentTitle(product ? `${product.name} · Norte Moda` : 'Producto no encontrado · Norte Moda')

  if (!product) {
    return <NotFoundPage />
  }

  return <ProductDetail product={product} catalog={catalog} />
}
