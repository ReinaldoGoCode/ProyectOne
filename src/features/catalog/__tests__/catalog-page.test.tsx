import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { CartProvider } from '@/app/providers/CartProvider'
import { CatalogProvider } from '@/app/providers/CatalogProvider'

import { CatalogPage } from '../CatalogPage'

function renderCatalog(path: string): string {
  return renderToStaticMarkup(
    <CatalogProvider>
      <CartProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/catalogo" element={<CatalogPage />} />
          </Routes>
        </MemoryRouter>
      </CartProvider>
    </CatalogProvider>,
  )
}

describe('página de catálogo', () => {
  it('muestra todas las piezas activas sin filtros', () => {
    const html = renderCatalog('/catalogo')

    expect(html).toContain('Toda la colección')
    expect(html).toContain('20 piezas')
    expect(html).toContain('Camisa de lino Margarita')
    expect(html).toContain('href="/producto/camisa-lino-margarita"')
    expect(html).not.toContain('Pantalón wide leg Valencia')
  })

  it('filtra por categoría desde la URL', () => {
    const html = renderCatalog('/catalogo?categoria=vestidos')

    expect(html).toContain('Vestido midi Canaima')
    expect(html).toContain('Vestido corto Paraguaná')
    expect(html).not.toContain('Camisa de lino Margarita')
    expect(html).toContain('aria-current="page"')
  })

  it('busca sin acentos y actualiza el resumen', () => {
    const html = renderCatalog('/catalogo?q=paraguana')

    expect(html).toContain('Vestido corto Paraguaná')
    expect(html).not.toContain('Vestido midi Canaima')
    expect(html).toContain('1 resultado para “paraguana”')
  })

  it('ordena por precio ascendente', () => {
    const html = renderCatalog('/catalogo?orden=precio-asc')

    expect(html.indexOf('Camiseta básica Pampatar')).toBeLessThan(
      html.indexOf('Chaqueta denim La Guaira'),
    )
  })

  it('ofrece limpiar los filtros cuando no hay resultados', () => {
    const html = renderCatalog('/catalogo?q=neopreno')

    expect(html).toContain('No encontramos esa prenda')
    expect(html).toContain('Limpiar filtros')
  })
})
