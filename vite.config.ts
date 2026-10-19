import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // GitHub Pages sirve el sitio bajo /ProyectOne/. En local queda en la raíz.
  base: process.env['VITE_BASE_PATH'] ?? '/',
  plugins: [react(), tailwindcss()],
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
