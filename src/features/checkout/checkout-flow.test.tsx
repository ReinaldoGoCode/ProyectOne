// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { CartProvider } from '@/app/providers/CartProvider'
import { CatalogProvider } from '@/app/providers/CatalogProvider'
import { OrderProvider } from '@/app/providers/OrderProvider'
import { createOrderRepository } from '@/data/repositories/orderRepository'
import { seedCatalog } from '@/data/seed'
import { createOrder } from '@/domain/order'
import { AdminPage } from '@/features/admin/AdminPage'
import { CartPage } from '@/features/cart/CartPage'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'
import { OrderTrackingPage } from '@/features/order-tracking/OrderTrackingPage'
import { ProductPage } from '@/features/product/ProductPage'
import { STORAGE_KEYS } from '@/data/storage'

function LocationProbe() {
  const location = useLocation()
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  )
}

function ShopRoutes({ initialEntry }: { readonly initialEntry: string }) {
  return (
    <CatalogProvider>
      <CartProvider>
        <OrderProvider>
          <MemoryRouter initialEntries={[initialEntry]}>
            <LocationProbe />
            <Routes>
              <Route path="/producto/:slug" element={<ProductPage />} />
              <Route path="/carrito" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/pedido" element={<OrderTrackingPage />} />
              <Route path="/admin/*" element={<AdminPage />} />
            </Routes>
          </MemoryRouter>
        </OrderProvider>
      </CartProvider>
    </CatalogProvider>
  )
}

function sampleOrder() {
  const product = seedCatalog.products[0]
  const variant = seedCatalog.variants.find(
    (item) => item.productId === product?.id && item.stock > 0,
  )
  if (!product || !variant) throw new Error('Falta una variante ficticia disponible.')
  return createOrder({
    code: 'NM-0001',
    customer: { firstName: 'Ana', lastName: 'Pérez', phone: '+58 412 000 0000', email: null },
    deliveryMethod: 'retiro',
    shippingAddress: null,
    shippingAgency: null,
    paymentMethod: 'efectivo',
    paymentReference: null,
    customerNote: null,
    items: [
      {
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        size: variant.size,
        color: variant.color,
        unitPriceCents: product.priceCents,
        quantity: 1,
      },
    ],
    shippingCents: 0,
  })
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('flujo de compra y administración', () => {
  it('añade una variante, ajusta cantidad, guarda el pedido y lo consulta por código', async () => {
    render(<ShopRoutes initialEntry="/producto/camisa-lino-margarita" />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir al carrito' }))
    fireEvent.click(screen.getByRole('link', { name: 'Ver carrito' }))
    expect(await screen.findByRole('heading', { name: 'Carrito' })).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Aumentar Camisa de lino Margarita en uno' }),
    )
    expect(screen.getByText('2 artículos')).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'Continuar al checkout' }))

    await screen.findByRole('heading', { name: 'Checkout' })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Pérez' } })
    fireEvent.change(screen.getByLabelText('Teléfono de contacto'), {
      target: { value: '+58 412 000 0000' },
    })
    fireEvent.change(screen.getByLabelText('Cómo coordinamos'), { target: { value: 'retiro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear pedido de demostración' }))

    expect(await screen.findByText(/Pedido guardado en este navegador/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'NM-0001' })).toBeTruthy()
    expect(screen.getByText(/Camisa de lino Margarita/)).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toContain('/pedido?codigo=NM-0001&creado=1')
    expect(window.localStorage.getItem(STORAGE_KEYS.cart)).toBeNull()
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.orders) ?? '[]')).toHaveLength(1)
  })

  it('registra pago y entrega en ejes separados y persiste cada transición', async () => {
    const order = sampleOrder()
    expect(createOrderRepository(window.localStorage).save(order)).toBe(true)
    render(<ShopRoutes initialEntry="/admin/pedidos" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Pasar a verificación' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar pago revisado' }))
    expect(screen.getByText('Pago · Pagado')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Entrega · Nuevo' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Preparando' }))
    expect(screen.getByRole('heading', { name: 'Entrega · Preparando' })).toBeTruthy()
    expect(screen.getByText('Pago · Pagado')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Despachado' }))
    expect(screen.getByRole('heading', { name: 'Entrega · Despachado' })).toBeTruthy()

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.orders) ?? '[]') as {
        paymentStatus: string
        fulfillmentStatus: string
        history: unknown[]
      }[]
      expect(saved[0]?.paymentStatus).toBe('pagado')
      expect(saved[0]?.fulfillmentStatus).toBe('despachado')
      expect(saved[0]?.history).toHaveLength(6)
    })
  })
})
