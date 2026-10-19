import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { NotFoundPage } from '@/features/not-found/NotFoundPage'

import { HomePage } from '../HomePage'

describe('portada', () => {
  it('presenta la propuesta y las piezas destacadas del seed', () => {
    const html = renderToStaticMarkup(<HomePage />)

    expect(html).toContain('Pocas prendas')
    expect(html).toContain('Camisa de lino Margarita')
    expect(html).toContain('$28,00')
    expect(html).toContain('href="/#seleccion"')
  })
})

describe('página 404', () => {
  it('explica el error y ofrece volver al inicio', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )

    expect(html).toContain('Esto no está en el perchero')
    expect(html).toContain('Volver al inicio')
  })
})
