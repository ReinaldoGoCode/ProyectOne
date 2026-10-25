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
    async closeBundle() {
      const outDir = resolve(process.cwd(), 'dist')
      const indexFile = resolve(outDir, 'index.html')
      const routes = new Set([
        'catalogo',
        'carrito',
        'checkout',
        'pedido',
        'admin',
        ...seedProducts.map((product) => `producto/${product.slug}`),
      ])

      for (const slug of await loadRemoteProductSlugs()) {
        routes.add(`producto/${slug}`)
      }

      for (const route of routes) {
        const target = resolve(outDir, route, 'index.html')
        mkdirSync(dirname(target), { recursive: true })
        copyFileSync(indexFile, target)
      }

      // GitHub Pages serves this app shell for remote product slugs added
      // after build, while React Router resolves the preserved URL client-side.
      copyFileSync(indexFile, resolve(outDir, '404.html'))
    },
  }
}

async function loadRemoteProductSlugs(): Promise<readonly string[]> {
  const projectUrl = process.env['VITE_SUPABASE_URL']?.trim()
  const publishableKey = process.env['VITE_SUPABASE_PUBLISHABLE_KEY']?.trim()
  if (!projectUrl || !publishableKey) return []

  try {
    const response = await fetch(
      `${projectUrl.replace(/\/$/, '')}/rest/v1/products?select=slug&active=eq.true&limit=5000`,
      { headers: { apikey: publishableKey } },
    )
    if (!response.ok) {
      console.warn(
        `No se pudieron incluir las rutas del catálogo remoto (HTTP ${String(response.status)}); se conserva el fallback 404.`,
      )
      return []
    }
    const rows: unknown = await response.json()
    if (!Array.isArray(rows)) return []
    return rows
      .map((row: unknown) =>
        typeof row === 'object' && row !== null && 'slug' in row ? row.slug : null,
      )
      .filter(
        (slug): slug is string =>
          typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),
      )
  } catch {
    console.warn(
      'No se pudieron incluir las rutas del catálogo remoto; se conserva el fallback 404.',
    )
    return []
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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return id.includes('/node_modules/@supabase/') ? 'supabase' : undefined
        },
      },
    },
  },
  test: {
    // La lógica de dominio no toca el DOM: no hace falta jsdom.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
