import { useParams } from 'react-router-dom'

import { seedProducts } from '@/data/seed'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

import { ProductDetail } from './ProductDetail'

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const product = seedProducts.find((item) => item.slug === slug)

  useDocumentTitle(product ? `${product.name} · Norte Moda` : 'Producto no encontrado · Norte Moda')

  if (!product) {
    return <NotFoundPage />
  }

  return <ProductDetail product={product} />
}
