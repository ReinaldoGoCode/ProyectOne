// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { seedCatalog } from '@/data/seed'
import type { Catalog } from '@/domain/types'
import { STORAGE_KEYS } from '@/data/storage'

import { CartProvider } from './CartProvider'
import { CatalogContext } from './catalogContext'
import type { CatalogContextValue } from './catalogContext'
import { useCart } from './cartContext'

const emptyCatalog: Catalog = { categories: [], products: [], variants: [] }

const catalogContext: CatalogContextValue = {
  catalog: emptyCatalog,
  catalogMode: 'loading',
  refreshCatalog: async () => {
    await Promise.resolve()
  },
  inventoryMovements: [],
  createProduct: () => {
    throw new Error('unused in test')
  },
  updateProduct: () => undefined,
  setProductActive: () => undefined,
  saveVariant: () => undefined,
  deleteVariant: () => undefined,
  applyInventoryCsv: () => ({
    createdProducts: 0,
    createdVariants: 0,
    changedVariants: 0,
    movements: 0,
  }),
  resetCatalog: () => undefined,
  consumeStockForOrder: () => false,
}

function CartProbe() {
  const { isReady, lines, summary } = useCart()
  return (
    <div>
      <p>{isReady ? 'carrito listo' : 'esperando catálogo'}</p>
      <p data-testid="line-count">{lines.length}</p>
      <p data-testid="subtotal">{summary.subtotalCents}</p>
    </div>
  )
}

function renderCart(value: CatalogContextValue) {
  return (
    <CatalogContext.Provider value={value}>
      <CartProvider>
        <CartProbe />
      </CartProvider>
    </CatalogContext.Provider>
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('hidratar carrito con catálogo remoto', () => {
  it('conserva las líneas almacenadas hasta que llegan las variantes de Supabase', async () => {
    const variant = seedCatalog.variants.find((item) => item.stock > 0)
    if (!variant) throw new Error('Falta una variante disponible para la prueba.')
    window.localStorage.setItem(
      STORAGE_KEYS.cart,
      JSON.stringify([{ variantId: variant.id, quantity: 1 }]),
    )

    const view = render(renderCart(catalogContext))
    expect(screen.getByText('esperando catálogo')).toBeTruthy()
    expect(window.localStorage.getItem(STORAGE_KEYS.cart)).toContain(variant.id)

    view.rerender(renderCart({ ...catalogContext, catalog: seedCatalog, catalogMode: 'connected' }))

    expect(await screen.findByText('carrito listo')).toBeTruthy()
    expect(screen.getByTestId('line-count').textContent).toBe('1')
    expect(screen.getByTestId('subtotal').textContent).toBe(
      String(seedCatalog.products.find((product) => product.id === variant.productId)?.priceCents),
    )
  })
})
