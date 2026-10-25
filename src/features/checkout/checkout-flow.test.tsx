// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { CartProvider } from '@/app/providers/CartProvider'
import { CatalogProvider } from '@/app/providers/CatalogProvider'
import { OrderProvider } from '@/app/providers/OrderProvider'
import { seedCatalog } from '@/data/seed'
import { RemoteAdminPage } from '@/features/admin/remote/RemoteAdminPage'
import { CartPage } from '@/features/cart/CartPage'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'
import { OrderTrackingPage } from '@/features/order-tracking/OrderTrackingPage'
import { ProductPage } from '@/features/product/ProductPage'
import { STORAGE_KEYS } from '@/data/storage'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'

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
              <Route path="/admin" element={<RemoteAdminPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </MemoryRouter>
        </OrderProvider>
      </CartProvider>
    </CatalogProvider>
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('flujo de compra y acceso administrativo', () => {
  it('mantiene el panel remoto inactivo cuando no hay configuración Supabase', async () => {
    render(<ShopRoutes initialEntry="/admin" />)

    expect(await screen.findByText(/El backend aún no está configurado en este sitio/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver vista previa del panel' })).toBeTruthy()
  })

  it('muestra una vista previa de solo lectura del panel remoto', async () => {
    render(<ShopRoutes initialEntry="/admin?vista=demo" />)

    expect(await screen.findByText(/Demostración con datos ficticios/)).toBeTruthy()
    expect(screen.getByText('NM-0107')).toBeTruthy()
    expect(screen.getByText('Resumen del negocio')).toBeTruthy()

    const reviewButton = screen.getByRole('button', { name: 'Confirmar pago revisado' })
    expect((reviewButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('retira la ruta del antiguo panel local sin autenticación', async () => {
    render(<ShopRoutes initialEntry="/admin/demo/pedidos" />)

    expect(
      await screen.findByRole('heading', { name: 'Esto no está en el perchero.' }),
    ).toBeTruthy()
  })

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
    expect(screen.getByText(/Esta demostración local no ofrece métodos de pago/)).toBeTruthy()
    expect(screen.queryByText(/Pago Móvil \(demo\)/)).toBeNull()
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
    expect(screen.getByRole('heading', { name: 'Continúa por WhatsApp' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copiar mensaje' })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toContain('/pedido?codigo=NM-0001&creado=1')
    expect(window.localStorage.getItem(STORAGE_KEYS.cart)).toBeNull()
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.orders) ?? '[]')).toHaveLength(1)

    fireEvent.change(screen.getByLabelText('Número de referencia'), {
      target: { value: 'REF-12345' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reportar pago para revisión' }))

    expect(await screen.findByText(/Referencia guardada en este navegador/)).toBeTruthy()
    expect(screen.getByText(/Referencia informada:/)).toBeTruthy()
    const [savedOrder] = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.orders) ?? '[]') as {
      paymentStatus: string
      paymentReference: string | null
    }[]
    expect(savedOrder).toMatchObject({
      paymentStatus: 'por_verificar',
      paymentReference: 'REF-12345',
    })
  })

  it('compra directamente una variante tras recargar y conserva el carrito independiente', async () => {
    const product = seedCatalog.products.find((item) => item.slug === 'camisa-lino-margarita')
    const cartVariant = seedCatalog.variants.find(
      (item) => item.productId === product?.id && item.color === 'Blanco' && item.size === 'S',
    )
    const directVariant = seedCatalog.variants.find(
      (item) => item.productId === product?.id && item.color === 'Negro' && item.size === 'S',
    )
    if (!product || !cartVariant || !directVariant) {
      throw new Error('Faltan variantes ficticias para probar la compra directa.')
    }

    render(<ShopRoutes initialEntry="/producto/camisa-lino-margarita" />)
    fireEvent.click(screen.getByRole('button', { name: 'Añadir al carrito' }))
    fireEvent.click(screen.getByRole('button', { name: 'Color Negro' }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Comprar ahora' }))

    await screen.findByRole('heading', { name: 'Checkout' })
    expect(screen.getByText(/2 × Camisa de lino Margarita/)).toBeTruthy()
    expect(screen.getByText(/Los artículos de tu carrito se conservan aparte/)).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toMatch(/^\/checkout\?compra=/)

    const checkoutPath = screen.getByTestId('location').textContent
    cleanup()
    render(<ShopRoutes initialEntry={checkoutPath} />)

    expect(await screen.findByText(/2 × Camisa de lino Margarita/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Pérez' } })
    fireEvent.change(screen.getByLabelText('Teléfono de contacto'), {
      target: { value: '+58 412 000 0000' },
    })
    fireEvent.change(screen.getByLabelText('Cómo coordinamos'), { target: { value: 'retiro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear pedido de demostración' }))

    expect(await screen.findByText(/Pedido guardado en este navegador/)).toBeTruthy()
    const savedCart = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.cart) ?? '[]') as {
      variantId: string
      quantity: number
    }[]
    expect(savedCart).toEqual([{ variantId: cartVariant.id, quantity: 1 }])
    const savedOrders = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.orders) ?? '[]') as {
      items: { variantId: string; quantity: number }[]
    }[]
    expect(savedOrders[0]?.items).toMatchObject([{ variantId: directVariant.id, quantity: 2 }])
  })

  it('no sustituye una compra directa inválida por el carrito existente', async () => {
    const variant = seedCatalog.variants.find((item) => item.stock > 0)
    if (!variant) throw new Error('Falta una variante ficticia disponible.')
    window.localStorage.setItem(
      STORAGE_KEYS.cart,
      JSON.stringify([{ variantId: variant.id, quantity: 1 }]),
    )

    render(<ShopRoutes initialEntry="/checkout?compra=123e4567-e89b-42d3-a456-426614174000" />)

    expect(await screen.findByText(/No se pudo recuperar esta compra directa/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver carrito conservado' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Crear pedido de demostración' })).toBeNull()
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.cart) ?? '[]')).toEqual([
      { variantId: variant.id, quantity: 1 },
    ])
  })
})
