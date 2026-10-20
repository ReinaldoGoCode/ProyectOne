import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

import { seedProducts } from './src/data/seed/products'

/**
 * GitHub Pages sirve archivos estáticos y no reescribe rutas. Copiar el
 * `index.html` del build a cada ruta conocida hace que `/catalogo` y
 * `/producto/:slug` respondan 200 en lugar de un 404 con la app dentro.
 */
function staticRouteCopies(): Plugin {
  return {
    name: 'norte-moda-static-routes',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(process.cwd(), 'dist')
      const indexFile = resolve(outDir, 'index.html')
      const routes = [
        'catalogo',
        'carrito',
        'checkout',
        'pedido',
        'admin',
        'admin/productos',
        'admin/pedidos',
        ...seedProducts.map((product) => `producto/${product.slug}`),
      ]

      for (const route of routes) {
        const target = resolve(outDir, route, 'index.html')
        mkdirSync(dirname(target), { recursive: true })
        copyFileSync(indexFile, target)
      }
    },
  }
}

export default defineConfig({
  // GitHub Pages sirve el sitio bajo /ProyectOne/. En local queda en la raíz.
  base: process.env['VITE_BASE_PATH'] ?? '/',
  plugins: [react(), tailwindcss(), staticRouteCopies()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    // La lógica de dominio no toca el DOM: no hace falta jsdom.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
