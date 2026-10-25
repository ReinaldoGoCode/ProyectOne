import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { useCatalog } from './catalogContext'
import { CartContext } from './cartContext'
import { addCartLine, removeCartLine, setCartQuantity, summarizeCart } from '@/domain/cart'
import { createCartRepository } from '@/data/repositories/cartRepository'

export function CartProvider({ children }: { readonly children: ReactNode }) {
  const { catalog, catalogMode } = useCatalog()
  const [repository] = useState(() => createCartRepository())
  const [lines, setLines] = useState(() =>
    catalogMode === 'loading' || catalogMode === 'error' ? [] : repository.load(catalog),
  )
  const [isReady, setIsReady] = useState(() => catalogMode !== 'loading' && catalogMode !== 'error')

  useEffect(() => {
    if (isReady || catalogMode === 'loading' || catalogMode === 'error') return
    let mounted = true
    void Promise.resolve().then(() => {
      if (!mounted) return
      setLines(repository.load(catalog))
      setIsReady(true)
    })
    return () => {
      mounted = false
    }
  }, [catalog, catalogMode, isReady, repository])

  function commit(next: typeof lines): void {
    repository.save(next, catalog)
    setLines(next)
  }

  function addToCart(variantId: string, quantity = 1): string | null {
    if (!isReady) return 'Estamos validando el catálogo para preparar tu carrito.'
    const variant = catalog.variants.find((item) => item.id === variantId)
    const product = variant
      ? catalog.products.find((item) => item.id === variant.productId)
      : undefined

    if (variant === undefined || product === undefined || !product.active || variant.stock <= 0) {
      return 'Esta variante ya no está disponible.'
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return 'Elige una cantidad válida.'
    }

    const next = addCartLine(lines, variantId, quantity, variant.stock)
    commit(next)
    return null
  }

  function updateQuantity(variantId: string, quantity: number): void {
    const variant = catalog.variants.find((item) => item.id === variantId)
    commit(setCartQuantity(lines, variantId, quantity, variant?.stock ?? 0))
  }

  function remove(variantId: string): void {
    commit(removeCartLine(lines, variantId))
  }

  function clear(): void {
    repository.reset()
    setLines([])
  }

  return (
    <CartContext.Provider
      value={{
        lines,
        isReady,
        summary: summarizeCart(lines, catalog),
        addToCart,
        setQuantity: updateQuantity,
        removeLine: remove,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}
