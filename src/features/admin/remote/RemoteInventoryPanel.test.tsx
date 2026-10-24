// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { seedCatalog } from '@/data/seed'
import type { Catalog } from '@/domain/types'

import { RemoteInventoryPanel } from './RemoteInventoryPanel'

afterEach(cleanup)

function renderPanel(
  onImport = vi.fn((_catalog: Catalog, _expected: Catalog) =>
    Promise.resolve({ createdProducts: 0, createdVariants: 0, changedVariants: 0 }),
  ),
  onStockAdjust = vi.fn((_id: string, _mode: string, quantity: number) =>
    Promise.resolve({ stock: quantity, delta: quantity }),
  ),
) {
  render(
    <RemoteInventoryPanel
      catalog={seedCatalog}
      movements={[]}
      onImport={onImport}
      onStockAdjust={onStockAdjust}
      onImageUpload={vi.fn(() => Promise.resolve())}
    />,
  )
  return { onImport, onStockAdjust }
}

describe('administración remota del inventario', () => {
  it('crea un producto y su primera variante usando el importador validado del servidor', async () => {
    const { onImport } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Producto de prueba' } })
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'TEST-NEW-01' } })
    fireEvent.change(screen.getByLabelText('Existencias iniciales'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledOnce()
    })
    const [nextCatalog] = onImport.mock.calls[0] ?? []
    expect(nextCatalog?.products.some((product) => product.id === 'producto-de-prueba')).toBe(true)
    expect(nextCatalog?.variants.find((variant) => variant.sku === 'TEST-NEW-01')?.stock).toBe(4)
    expect(await screen.findByText('Producto creado en Supabase.')).toBeTruthy()
  })

  it('envía el ajuste de una variante y muestra el nuevo total', async () => {
    const { onStockAdjust } = renderPanel()
    const variant = seedCatalog.variants[0]
    if (!variant) throw new Error('Falta la variante del fixture')
    const operation = screen.getByLabelText(`Operación de stock ${variant.sku}`)
    const quantity = screen.getByLabelText(`Cantidad para ${variant.sku}`)
    fireEvent.change(operation, { target: { value: 'add' } })
    fireEvent.change(quantity, { target: { value: '2' } })
    const row = operation.closest('tr')
    const saveButton = row?.querySelector('button')
    if (!saveButton) throw new Error('No se encontró el botón de guardar stock')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(onStockAdjust).toHaveBeenCalledWith(variant.id, 'add', 2, '')
    })
    expect(await screen.findByText('Existencias guardadas. Nuevo total: 2.')).toBeTruthy()
  })

  it('muestra el rechazo del servidor en vez de esconder un ajuste inválido', async () => {
    const onStockAdjust = vi.fn(() =>
      Promise.reject(new Error('La salida supera las existencias disponibles.')),
    )
    renderPanel(undefined, onStockAdjust)
    const variant = seedCatalog.variants[0]
    if (!variant) throw new Error('Falta la variante del fixture')
    const operation = screen.getByLabelText(`Operación de stock ${variant.sku}`)
    fireEvent.change(operation, { target: { value: 'subtract' } })
    fireEvent.change(screen.getByLabelText(`Cantidad para ${variant.sku}`), {
      target: { value: String(variant.stock + 1) },
    })
    const saveButton = operation.closest('tr')?.querySelector('button')
    if (!saveButton) throw new Error('No se encontró el botón de guardar stock')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(
        screen
          .getAllByRole('alert')
          .some((alert) =>
            alert.textContent.includes('La salida supera las existencias disponibles.'),
          ),
      ).toBe(true)
    })
  })
})
