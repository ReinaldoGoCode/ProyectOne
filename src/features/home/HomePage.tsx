import { useDocumentTitle } from '@/hooks/useDocumentTitle'

import { FeaturedProducts } from './FeaturedProducts'
import { Hero } from './Hero'
import { HowItWorks } from './HowItWorks'
import { StoreStory } from './StoreStory'

export function HomePage() {
  useDocumentTitle('Norte Moda · Ropa para el día a día')

  return (
    <>
      <Hero />
      <FeaturedProducts />
      <StoreStory />
      <HowItWorks />
    </>
  )
}
