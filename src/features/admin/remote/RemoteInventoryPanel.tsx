import { useState } from 'react'

import { buttonClassName } from '@/components/ui/button'
import {
  createInventoryCsvTemplate,
  exportInventoryCsv,
  planInventoryCsv,
} from '@/data/inventoryCsv'
import type { Catalog, InventoryMovement } from '@/domain/types'
import type { RemoteInventoryImportResult } from '@/data/repositories/remoteOrderGateway'

const REASON_LABELS: Readonly<Record<InventoryMovement['reason'], string>> = {
  receipt: 'Entrada',
  sale: 'Venta',
  adjustment: 'Ajuste',
  import: 'Importación',
}

function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function RemoteInventoryPanel({
  catalog,
  movements,
  onImport,
  onImageUpload,
}: {
  readonly catalog: Catalog
  readonly movements: readonly InventoryMovement[]
  readonly onImport: (
    catalog: Catalog,
    expectedCatalog: Catalog,
  ) => Promise<RemoteInventoryImportResult>
  readonly onImageUpload: (productId: string, file: File) => Promise<void>
}) {
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<ReturnType<typeof planInventoryCsv> | null>(null)
  const [thresholdText, setThresholdText] = useState('3')
  const [busy, setBusy] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageProductId, setImageProductId] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const threshold = Number(thresholdText)
  const lowStock = catalog.variants
    .filter((variant) => variant.stock <= (Number.isSafeInteger(threshold) ? threshold : 3))
    .map((variant) => ({
      variant,
      product: catalog.products.find((product) => product.id === variant.productId),
    }))
    .filter((item) => item.product)
    .sort((a, b) => a.variant.stock - b.variant.stock)
  const selectedImageProduct =
    catalog.products.find((product) => product.id === imageProductId) ?? catalog.products[0]

  async function saveImage(): Promise<void> {
    if (!selectedImageProduct || !imageFile || imageBusy) return
    setError('')
    setNotice('')
    setImageBusy(true)
    try {
      await onImageUpload(selectedImageProduct.id, imageFile)
      setImageFile(null)
      setNotice(`La imagen de “${selectedImageProduct.name}” se actualizó.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo actualizar la imagen.')
    } finally {
      setImageBusy(false)
    }
  }

  async function readFile(file: File | undefined): Promise<void> {
    if (!file) return
    setError('')
    setNotice('')
    try {
      const text = await file.text()
      setCsvText(text)
      setPreview(planInventoryCsv(catalog, text))
    } catch {
      setError('No se pudo leer el archivo. Guárdalo como CSV UTF-8 e inténtalo de nuevo.')
      setPreview(null)
    }
  }

  async function applyImport(): Promise<void> {
    if (!preview?.catalog || preview.errors.length || busy) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const result = await onImport(preview.catalog, catalog)
      setNotice(
        `Guardado en el servidor: ${String(result.createdProducts)} productos nuevos, ${String(result.createdVariants)} variantes nuevas y ${String(result.changedVariants)} variantes con existencias actualizadas.`,
      )
      setCsvText('')
      setPreview(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo aplicar el archivo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      id="admin-inventory"
      className="mt-8 scroll-mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-stone-900/10 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-brand-700 uppercase">
            Catálogo e inventario remoto
          </p>
          <h2 className="mt-2 text-2xl font-medium tracking-tight">Productos por SKU y variante</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
            Los cambios se validan como un solo lote y se guardan en Supabase con sus movimientos de
            inventario. Usa el mismo SKU para identificar cada talla y color.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              downloadCsv('norte-moda-plantilla-inventario.csv', createInventoryCsvTemplate())
            }}
            className={buttonClassName('secondary', 'py-2')}
          >
            Descargar plantilla
          </button>
          <button
            type="button"
            onClick={() => {
              downloadCsv('norte-moda-catalogo-remoto.csv', exportInventoryCsv(catalog))
            }}
            className={buttonClassName('secondary', 'py-2')}
          >
            Exportar catálogo
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.75fr)]">
        <div>
          <div className="mb-6 rounded-2xl bg-paper/80 p-4">
            <h3 className="font-medium">Imagen del producto</h3>
            <p className="mt-1 text-xs text-stone-500">JPG, PNG o WebP · máximo 5 MB.</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="min-w-48 flex-1 text-xs font-medium text-stone-600">
                Producto
                <select
                  value={selectedImageProduct?.id ?? ''}
                  onChange={(event) => {
                    setImageProductId(event.currentTarget.value)
                  }}
                  className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm ring-1 ring-stone-900/12"
                >
                  {catalog.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedImageProduct ? (
                <img
                  src={selectedImageProduct.imageUrl}
                  alt={selectedImageProduct.imageAlt}
                  className="h-16 w-14 rounded-lg bg-white object-cover ring-1 ring-stone-900/10"
                />
              ) : null}
              <label className="min-w-48 flex-1 text-xs font-medium text-stone-600">
                Subir o cambiar imagen
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    setImageFile(event.currentTarget.files?.[0] ?? null)
                  }}
                  className="mt-1.5 block w-full text-xs"
                />
              </label>
              <button
                type="button"
                disabled={!selectedImageProduct || !imageFile || imageBusy}
                onClick={() => void saveImage()}
                className={buttonClassName('secondary', 'py-2 disabled:opacity-45')}
              >
                {imageBusy ? 'Subiendo…' : 'Guardar imagen'}
              </button>
            </div>
          </div>
          <label
            className="block text-xs font-medium text-stone-600"
            htmlFor="remote-inventory-file"
          >
            Importar archivo CSV
          </label>
          <input
            id="remote-inventory-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void readFile(event.currentTarget.files?.[0])}
            className="mt-2 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-xs file:font-medium file:text-paper"
          />
          <label
            className="mt-4 block text-xs font-medium text-stone-600"
            htmlFor="remote-inventory-csv"
          >
            O pega el contenido CSV
          </label>
          <textarea
            id="remote-inventory-csv"
            value={csvText}
            onChange={(event) => {
              setCsvText(event.currentTarget.value)
              setPreview(null)
            }}
            rows={5}
            spellCheck={false}
            placeholder="product_slug,product_name,category,description,price_usd,active,sku,size,color,stock_on_hand,stock_delta"
            className="mt-2 w-full rounded-xl bg-white px-3 py-2 font-mono text-xs leading-relaxed ring-1 ring-stone-900/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setError('')
                setNotice('')
                setPreview(planInventoryCsv(catalog, csvText))
              }}
              className={buttonClassName('secondary')}
            >
              Validar y previsualizar
            </button>
            <button
              type="button"
              disabled={!preview?.catalog || preview.errors.length > 0 || busy}
              onClick={() => void applyImport()}
              className={buttonClassName(
                'primary',
                'disabled:cursor-not-allowed disabled:opacity-45',
              )}
            >
              {busy ? 'Guardando…' : 'Guardar en el servidor'}
            </button>
          </div>
          {preview ? (
            preview.errors.length ? (
              <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-900">
                <strong>Corrige estos datos antes de importar ({preview.errors.length}):</strong>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {preview.errors.slice(0, 12).map((issue, index) => (
                    <li key={`${String(issue.row)}-${String(index)}`}>
                      Fila {issue.row}: {issue.message}
                    </li>
                  ))}
                </ul>
                {preview.errors.length > 12 ? (
                  <p className="mt-2">Se muestran los primeros 12 errores.</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">
                <strong>Vista previa válida.</strong> {preview.createdProducts} productos y{' '}
                {preview.createdVariants} variantes nuevas; {preview.changedVariants} variantes
                afectadas. Aún no se ha guardado.
              </div>
            )
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p aria-live="polite" className="mt-3 text-sm text-emerald-800">
              {notice}
            </p>
          ) : null}
          <p className="mt-3 text-xs leading-relaxed text-stone-500">
            <code>stock_delta</code> suma o descuenta existencias; <code>stock_on_hand</code> fija
            el total. Deja vacíos ambos para conservar el stock. Los cambios de precio y descripción
            también se aplican desde el archivo.
          </p>
        </div>

        <div className="rounded-2xl bg-paper/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">Pocas existencias</h3>
            <label className="flex items-center gap-2 text-xs text-stone-600">
              Umbral
              <input
                aria-label="Umbral de inventario bajo"
                type="number"
                min="0"
                max="9999"
                value={thresholdText}
                onChange={(event) => {
                  setThresholdText(event.currentTarget.value)
                }}
                className="w-16 rounded-lg bg-white px-2 py-1.5 text-sm tabular-nums ring-1 ring-stone-900/10"
              />
            </label>
          </div>
          {lowStock.length ? (
            <ul className="mt-3 max-h-64 divide-y divide-stone-900/8 overflow-y-auto text-sm">
              {lowStock.map(({ variant, product }) => (
                <li key={variant.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{product?.name}</p>
                    <p className="text-xs text-stone-500">
                      {variant.size} · {variant.color} · {variant.sku}
                    </p>
                  </div>
                  <strong className="tabular-nums text-amber-900">{variant.stock}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-stone-500">No hay variantes bajo este umbral.</p>
          )}
        </div>
      </div>

      <div className="mt-7 border-t border-stone-900/10 pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-medium">Movimientos recientes</h3>
          <p className="text-xs text-stone-500">Historial remoto · {movements.length} registros</p>
        </div>
        {movements.length ? (
          <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-stone-900/10">
            <table className="w-full min-w-[38rem] text-left text-xs">
              <thead className="bg-paper text-stone-500">
                <tr>
                  <th className="p-3 font-medium">Fecha</th>
                  <th className="p-3 font-medium">Artículo / SKU</th>
                  <th className="p-3 font-medium">Tipo</th>
                  <th className="p-3 text-right font-medium">Unidades</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-900/8 bg-white/60">
                {movements.slice(0, 40).map((movement) => (
                  <tr key={movement.id}>
                    <td className="p-3 text-stone-500">
                      {new Date(movement.createdAt).toLocaleString('es-VE')}
                    </td>
                    <td className="p-3">
                      <span className="font-medium">{movement.productName}</span>
                      <span className="ml-2 text-stone-500">
                        {movement.sku} · {movement.size}/{movement.color}
                      </span>
                      {movement.note ? (
                        <span className="mt-1 block text-stone-500">{movement.note}</span>
                      ) : null}
                    </td>
                    <td className="p-3">{REASON_LABELS[movement.reason]}</td>
                    <td
                      className={`p-3 text-right font-semibold tabular-nums ${movement.delta > 0 ? 'text-emerald-800' : 'text-red-800'}`}
                    >
                      {movement.delta > 0 ? '+' : ''}
                      {movement.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-500">
            Al aplicar entradas, salidas o ajustes aparecerán aquí.
          </p>
        )}
      </div>
    </section>
  )
}
