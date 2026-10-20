import { createContext, useContext } from 'react'

import type { CartSummary } from '@/domain/cart'
import type { CartLine } from '@/domain/types'

export interface CartContextValue {
  readonly lines: readonly CartLine[]
  readonly summary: CartSummary
  readonly addToCart: (variantId: string, quantity?: number) => string | null
  readonly setQuantity: (variantId: string, quantity: number) => void
  readonly removeLine: (variantId: string) => void
  readonly clear: () => void
}

export const CartContext = createContext<CartContextValue | null>(null)

export function useCart(): CartContextValue {
  const context = useContext(CartContext)

  if (context === null) {
    throw new Error('useCart debe usarse dentro de CartProvider')
  }

  return context
}
