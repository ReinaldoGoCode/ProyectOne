import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { StoreLayout } from '@/app/layouts/StoreLayout'
import { CartProvider } from '@/app/providers/CartProvider'
import { CatalogProvider } from '@/app/providers/CatalogProvider'
import { OrderProvider } from '@/app/providers/OrderProvider'
/**
 * En GitHub Pages el sitio vive bajo `/ProyectOne/`, así que el router toma
 * la base de Vite. `BASE_URL` termina en `/`; React Router espera la base sin
 * esa barra final (salvo la raíz).
 */
const baseUrl = import.meta.env.BASE_URL
const basename = baseUrl === '/' ? '/' : baseUrl.replace(/\/$/, '')

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <StoreLayout />,
      children: [
        {
          index: true,
          lazy: async () => ({ Component: (await import('@/features/home/HomePage')).HomePage }),
        },
        {
          path: 'catalogo',
          lazy: async () => ({
            Component: (await import('@/features/catalog/CatalogPage')).CatalogPage,
          }),
        },
        {
          path: 'carrito',
          lazy: async () => ({ Component: (await import('@/features/cart/CartPage')).CartPage }),
        },
        {
          path: 'checkout',
          lazy: async () => ({
            Component: (await import('@/features/checkout/CheckoutPage')).CheckoutPage,
          }),
        },
        {
          path: 'pedido',
          lazy: async () => ({
            Component: (await import('@/features/order-tracking/OrderTrackingPage'))
              .OrderTrackingPage,
          }),
        },
        {
          path: 'admin/*',
          lazy: async () => ({ Component: (await import('@/features/admin/AdminPage')).AdminPage }),
        },
        {
          path: 'producto/:slug',
          lazy: async () => ({
            Component: (await import('@/features/product/ProductPage')).ProductPage,
          }),
        },
        {
          path: '*',
          lazy: async () => ({
            Component: (await import('@/features/not-found/NotFoundPage')).NotFoundPage,
          }),
        },
      ],
    },
  ],
  { basename },
)

export function AppRouter() {
  return (
    <CatalogProvider>
      <CartProvider>
        <OrderProvider>
          <RouterProvider router={router} />
        </OrderProvider>
      </CartProvider>
    </CatalogProvider>
  )
}
