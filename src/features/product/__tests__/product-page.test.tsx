import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { ProductPage } from '../ProductPage'

function renderProduct(path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/producto/:slug" element={<ProductPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ficha de producto', () => {
  it('muestra la prenda, el precio y la selección por defecto', () => {
    const html = renderProduct('/producto/camisa-lino-margarita')

    expect(html).toContain('Camisa de lino Margarita')
    expect(html).toContain('$28,00')
    expect(html).toContain('4 unidades disponibles')
    expect(html).toContain('Consultar por WhatsApp')
    expect(html).toContain('Copiar mensaje')
    expect(html).toContain('https://wa.me/584125550134?text=')
  })

  it('respeta la talla y el color elegidos en la URL', () => {
    const html = renderProduct('/producto/camisa-lino-margarita?talla=M&color=Negro')

    expect(html).toContain('3 unidades disponibles')
    expect(html).toContain('aria-pressed="true"')
  })

  it('deshabilita las combinaciones agotadas del color elegido', () => {
    const html = renderProduct('/producto/camisa-lino-margarita?talla=S&color=Negro')

    expect(html).toContain('aria-label="Talla XL (agotada)"')
    expect(html).toContain('disabled=""')
  })

  it('muestra el estado agotado y desactiva la acción de WhatsApp', () => {
    const html = renderProduct('/producto/vestido-lino-isla')

    expect(html).toContain('Agotado por ahora')
    expect(html).not.toContain('https://wa.me/')
  })

  it('usa la página 404 cuando el producto no existe', () => {
    const html = renderProduct('/producto/no-existe')

    expect(html).toContain('Esto no está en el perchero')
  })
})
