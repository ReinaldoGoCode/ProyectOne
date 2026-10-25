// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { parsePagoMovilDetails, PAGO_MOVIL_INSTRUCTIONS } from '@/config/pagoMovil'
import { PagoMovilDetails } from './PagoMovilDetails'

afterEach(() => {
  cleanup()
})

describe('datos de Pago Móvil', () => {
  it('muestra los datos autorizados y permite copiar cada uno', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const details = parsePagoMovilDetails(PAGO_MOVIL_INSTRUCTIONS)
    if (!details) throw new Error('Faltan datos válidos de Pago Móvil para probar.')
    render(<PagoMovilDetails instructions={PAGO_MOVIL_INSTRUCTIONS} />)

    for (const detail of details) {
      expect(screen.getByText(detail.value)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: `Copiar ${detail.label}` }))
      expect(await screen.findByRole('status')).toBeTruthy()
      expect(writeText).toHaveBeenLastCalledWith(detail.value)
    }
  })

  it('indica la tasa oficial y su fecha de vigencia antes de pagar', () => {
    render(<PagoMovilDetails instructions={PAGO_MOVIL_INSTRUCTIONS} />)
    expect(
      screen.getByText(/feed público de DolarVZLA para la tasa BCV.*fecha de vigencia/i),
    ).toBeTruthy()
  })
})
