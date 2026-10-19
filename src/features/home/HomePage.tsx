import { FeaturedProducts } from './FeaturedProducts'
import { Hero } from './Hero'
import { HowItWorks } from './HowItWorks'
import { StoreStory } from './StoreStory'

export function HomePage() {
  return (
    <>
      <Hero />
      <FeaturedProducts />
      <StoreStory />
      <HowItWorks />
    </>
  )
}
