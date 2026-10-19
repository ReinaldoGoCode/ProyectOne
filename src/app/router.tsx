import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { StoreLayout } from '@/app/layouts/StoreLayout'
import { CatalogPage } from '@/features/catalog/CatalogPage'
import { HomePage } from '@/features/home/HomePage'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { ProductPage } from '@/features/product/ProductPage'

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
        { index: true, element: <HomePage /> },
        { path: 'catalogo', element: <CatalogPage /> },
        { path: 'producto/:slug', element: <ProductPage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename },
)

export function AppRouter() {
  return <RouterProvider router={router} />
}
