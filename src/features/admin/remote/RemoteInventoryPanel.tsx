import { useState } from 'react'

import { buttonClassName } from '@/components/ui/button'
import {
  createInventoryCsvTemplate,
  exportInventoryCsv,
  planInventoryCsv,
} from '@/data/inventoryCsv'
import type { Catalog, InventoryMovement } from '@/domain/types'
import { slugify } from '@/lib/text'
import type {
  RemoteInventoryImportResult,
  RemoteStockAdjustmentMode,
} from '@/data/repositories/remoteOrderGateway'

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único'] as const
type StockFilter = 'all' | 'available' | 'low' | 'out'
interface ProductForm {
  id: string
  name: string
  categoryId: string
  description: string
  composition: string
  care: string
  price: string
  imageUrl: string
  imageAlt: string
  active: boolean
  sku: string
  size: (typeof SIZE_OPTIONS)[number]
  color: string
  initialStock: string
}
interface StockInput {
  mode: RemoteStockAdjustmentMode
  quantity: string
  note: string
}

function emptyProductForm(categoryId: string, imageUrl: string): ProductForm {
  return {
    id: '',
    name: '',
    categoryId,
    description: '',
    composition: 'Demostración',
    care: 'Datos de muestra',
    price: '24.00',
    imageUrl,
    imageAlt: '',
    active: true,
    sku: '',
    size: 'Único',
    color: 'Muestra',
    initialStock: '0',
  }
}

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
  onStockAdjust,
  onImageUpload,
}: {
  readonly catalog: Catalog
  readonly movements: readonly InventoryMovement[]
  readonly onImport: (
    catalog: Catalog,
    expectedCatalog: Catalog,
  ) => Promise<RemoteInventoryImportResult>
  readonly onStockAdjust: (
    variantId: string,
    mode: RemoteStockAdjustmentMode,
    quantity: number,
    note: string,
  ) => Promise<{ readonly stock: number; readonly delta: number }>
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
  const [productSearch, setProductSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [productForm, setProductForm] = useState<ProductForm>(() =>
    emptyProductForm(
      catalog.categories[0]?.id ?? '',
      catalog.products[0]?.imageUrl ?? '/images/products/placeholder.svg',
    ),
  )
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [stockInputs, setStockInputs] = useState<Record<string, StockInput>>({})
  const [busyVariantId, setBusyVariantId] = useState<string | null>(null)
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
  const filteredProducts = catalog.products.filter((product) => {
    const matchesSearch = `${product.name} ${product.id}`
      .toLocaleLowerCase('es')
      .includes(productSearch.trim().toLocaleLowerCase('es'))
    const matchesCategory = categoryFilter === 'all' || product.categoryId === categoryFilter
    const variants = catalog.variants.filter((variant) => variant.productId === product.id)
    const available = variants.some((variant) => variant.stock > 0)
    const low = variants.some((variant) => variant.stock > 0 && variant.stock <= threshold)
    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'available' && available) ||
      (stockFilter === 'low' && low) ||
      (stockFilter === 'out' && !available)
    return matchesSearch && matchesCategory && matchesStock
  })

  function startCreateProduct(): void {
    setProductForm(
      emptyProductForm(
        catalog.categories[0]?.id ?? '',
        catalog.products[0]?.imageUrl ?? '/images/products/placeholder.svg',
      ),
    )
    setProductFormOpen(true)
    setError('')
    setNotice('')
  }

  function startEditProduct(productId: string): void {
    const product = catalog.products.find((item) => item.id === productId)
    if (!product) return
    setProductForm({
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      description: product.description,
      composition: product.composition,
      care: product.care,
      price: (product.priceCents / 100).toFixed(2),
      imageUrl: product.imageUrl,
      imageAlt: product.imageAlt,
      active: product.active,
      sku: '',
      size: 'Único',
      color: 'Muestra',
      initialStock: '0',
    })
    setProductFormOpen(true)
    setError('')
    setNotice('')
  }

  async function saveProduct(): Promise<void> {
    if (busy) return
    const name = productForm.name.trim()
    const slug = productForm.id || slugify(name)
    const price = Number(productForm.price.replace(',', '.'))
    const initialStock = Number(productForm.initialStock)
    if (!name || !slug || !productForm.categoryId || !Number.isFinite(price) || price <= 0) {
      setError('Completa nombre, categoría y un precio mayor que cero.')
      return
    }
    if (!productForm.id && catalog.products.some((product) => product.id === slug)) {
      setError('Ya existe un producto con ese nombre o identificador.')
      return
    }
    if (
      !productForm.id &&
      (!productForm.sku.trim() ||
        !productForm.color.trim() ||
        !Number.isSafeInteger(initialStock) ||
        initialStock < 0)
    ) {
      setError('Completa SKU, color y existencias iniciales válidas para la variante.')
      return
    }
    const product = {
      id: slug,
      slug,
      name,
      categoryId: productForm.categoryId,
      description: productForm.description.trim(),
      composition: productForm.composition.trim(),
      care: productForm.care.trim(),
      priceCents: Math.round(price * 100),
      imageUrl: productForm.imageUrl.trim(),
      imageAlt: productForm.imageAlt.trim() || name,
      active: productForm.active,
      createdAt:
        catalog.products.find((item) => item.id === slug)?.createdAt ?? new Date().toISOString(),
    }
    if (!product.imageUrl) {
      setError('Indica una URL de imagen o usa la imagen de muestra preseleccionada.')
      return
    }
    const variants = productForm.id
      ? catalog.variants
      : [
          ...catalog.variants,
          {
            id: slugify(`${slug}-${productForm.size}-${productForm.color}`),
            productId: slug,
            size: productForm.size,
            color: productForm.color.trim(),
            sku: productForm.sku.trim().toUpperCase(),
            stock: initialStock,
          },
        ]
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const nextCatalog = {
        ...catalog,
        products: productForm.id
          ? catalog.products.map((item) => (item.id === slug ? product : item))
          : [...catalog.products, product],
        variants,
      }
      await onImport(nextCatalog, catalog)
      setProductFormOpen(false)
      setNotice(
        productForm.id ? 'Producto actualizado en Supabase.' : 'Producto creado en Supabase.',
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el producto.')
    } finally {
      setBusy(false)
    }
  }

  async function saveStock(variantId: string): Promise<void> {
    const input = stockInputs[variantId] ?? { mode: 'add' as const, quantity: '1', note: '' }
    const quantity = Number(input.quantity)
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      setError('La cantidad de existencias debe ser un entero igual o mayor que cero.')
      return
    }
    setError('')
    setNotice('')
    setBusyVariantId(variantId)
    try {
      const result = await onStockAdjust(variantId, input.mode, quantity, input.note)
      setNotice(`Existencias guardadas. Nuevo total: ${String(result.stock)}.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el inventario.')
    } finally {
      setBusyVariantId(null)
    }
  }

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

      <div className="mt-6 rounded-2xl bg-paper/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">Administrar productos y variantes</h3>
            <p className="mt-1 text-xs text-stone-600">
              Stock por talla y color. Los productos se desactivan para retirarlos de la tienda sin
              borrar su historial.
            </p>
          </div>
          <button
            type="button"
            onClick={startCreateProduct}
            className={buttonClassName('primary', 'py-2')}
          >
            Crear producto
          </button>
        </div>

        {productFormOpen ? (
          <form
            className="mt-4 grid gap-3 rounded-xl bg-white p-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              void saveProduct()
            }}
          >
            <label className="text-xs font-medium text-stone-600">
              Nombre
              <input
                required
                maxLength={180}
                value={productForm.name}
                onChange={(event) => {
                  setProductForm({ ...productForm, name: event.currentTarget.value })
                }}
                className="mt-1.5 min-h-10 w-full rounded-lg px-3 text-sm ring-1 ring-stone-900/15"
              />
            </label>
            <label className="text-xs font-medium text-stone-600">
              Categoría
              <select
                required
                value={productForm.categoryId}
                onChange={(event) => {
                  setProductForm({ ...productForm, categoryId: event.currentTarget.value })
                }}
                className="mt-1.5 min-h-10 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-stone-900/15"
              >
                {catalog.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-stone-600">
              Precio en USD
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={productForm.price}
                onChange={(event) => {
                  setProductForm({ ...productForm, price: event.currentTarget.value })
                }}
                className="mt-1.5 min-h-10 w-full rounded-lg px-3 text-sm ring-1 ring-stone-900/15"
              />
            </label>
            <label className="text-xs font-medium text-stone-600">
              URL de imagen
              <input
                required
                value={productForm.imageUrl}
                onChange={(event) => {
                  setProductForm({ ...productForm, imageUrl: event.currentTarget.value })
                }}
                className="mt-1.5 min-h-10 w-full rounded-lg px-3 text-sm ring-1 ring-stone-900/15"
              />
            </label>
            <label className="text-xs font-medium text-stone-600 sm:col-span-2">
              Descripción
              <textarea
                maxLength={5000}
                rows={2}
                value={productForm.description}
                onChange={(event) => {
                  setProductForm({ ...productForm, description: event.currentTarget.value })
                }}
                className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm ring-1 ring-stone-900/15"
              />
            </label>
            <label className="text-xs font-medium text-stone-600">
              Composición
              <input
                maxLength={500}
                value={productForm.composition}
                onChange={(event) => {
                  setProductForm({ ...productForm, composition: event.currentTarget.value })
                }}
                className="mt-1.5 min-h-10 w-full rounded-lg px-3 text-sm ring-1 ring-stone-900/15"
              />
            </label>
            <label className="text-xs font-medium text-stone-600">
              Cuidados
              <input
                maxLength={1000}
                value={productForm.care}
                onChange={(event) => {
                  setProductForm({ ...productForm, care: event.currentTarget.value })
                }}
                className="mt-1.5 min-h-10 w-full rounded-lg px-3 text-sm ring-1 ring-stone-900/15"
              />
            </label>
            {!productForm.id ? (
              <>
                <p className="text-xs font-medium text-stone-500 sm:col-span-2">
                  Primera variante (puedes añadir más después con el CSV):
                </p>
                <label className="text-xs font-medium text-stone-600">
                  SKU
                  <input
                    required
                    maxLength={100}
                    value={productForm.sku}
                    onChange={(event) => {
                      setProductForm({ ...productForm, sku: event.currentTarget.value })
                    }}
                    className="mt-1.5 min-h-10 w-full rounded-lg px-3 text-sm ring-1 ring-stone-900/15"
                  />
                </label>
                <label className="text-xs font-medium text-stone-600">
                  Talla
                  <select
                    value={productForm.size}
                    onChange={(event) => {
                      setProductForm({
                        ...productForm,
                        size: event.currentTarget.value as ProductForm['size'],
                      })
                    }}
                    className="mt-1.5 min-h-10 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-stone-900/15"
                  >
                    {SIZE_OPTIONS.map((size) => (
                      <option key={size}>{size}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-stone-600">
                  Color
                  <input
                    required
                    maxLength={80}
                    value={productForm.color}
                    onChange={(event) => {
                      setProductForm({ ...productForm, color: event.currentTarget.value })
                    }}
                    className="mt-1.5 min-h-10 w-full rounded-lg px-3 text-sm ring-1 ring-stone-900/15"
                  />
                </label>
                <label className="text-xs font-medium text-stone-600">
                  Existencias iniciales
                  <input
                    required
                    type="number"
                    min="0"
                    max="999999999"
                    step="1"
                    value={productForm.initialStock}
                    onChange={(event) => {
                      setProductForm({ ...productForm, initialStock: event.currentTarget.value })
                    }}
                    className="mt-1.5 min-h-10 w-full rounded-lg px-3 text-sm ring-1 ring-stone-900/15"
                  />
                </label>
              </>
            ) : null}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={productForm.active}
                onChange={(event) => {
                  setProductForm({ ...productForm, active: event.currentTarget.checked })
                }}
              />
              Publicado en la tienda (desmarca para retirarlo sin borrar su historial)
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                disabled={busy || catalog.categories.length === 0}
                className={buttonClassName('primary', 'py-2 disabled:opacity-45')}
                type="submit"
              >
                {busy ? 'Guardando…' : 'Guardar producto'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductFormOpen(false)
                }}
                className={buttonClassName('secondary', 'py-2')}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <input
            aria-label="Buscar producto"
            placeholder="Buscar por nombre"
            value={productSearch}
            onChange={(event) => {
              setProductSearch(event.currentTarget.value)
            }}
            className="min-h-10 rounded-lg bg-white px-3 text-sm ring-1 ring-stone-900/12"
          />
          <select
            aria-label="Filtrar categoría"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.currentTarget.value)
            }}
            className="min-h-10 rounded-lg bg-white px-3 text-sm ring-1 ring-stone-900/12"
          >
            <option value="all">Todas las categorías</option>
            {catalog.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar disponibilidad"
            value={stockFilter}
            onChange={(event) => {
              setStockFilter(event.currentTarget.value as StockFilter)
            }}
            className="min-h-10 rounded-lg bg-white px-3 text-sm ring-1 ring-stone-900/12"
          >
            <option value="all">Cualquier existencia</option>
            <option value="available">Con stock</option>
            <option value="low">Stock bajo</option>
            <option value="out">Agotados</option>
          </select>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl bg-white ring-1 ring-stone-900/10">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-stone-50 text-xs text-stone-600">
              <tr>
                <th className="p-3">Producto / variante</th>
                <th className="p-3">Publicación</th>
                <th className="p-3">Existencias</th>
                <th className="p-3">Movimiento</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-900/8">
              {filteredProducts.map((product) => {
                const variants = catalog.variants.filter(
                  (variant) => variant.productId === product.id,
                )
                return variants.length ? (
                  variants.map((variant) => {
                    const input = stockInputs[variant.id] ?? {
                      mode: 'add' as const,
                      quantity: '1',
                      note: '',
                    }
                    return (
                      <tr key={variant.id}>
                        <td className="p-3">
                          <strong className="block">{product.name}</strong>
                          <span className="text-xs text-stone-500">
                            {variant.size} · {variant.color} · SKU {variant.sku}
                          </span>
                        </td>
                        <td className="p-3">{product.active ? 'Publicado' : 'Oculto'}</td>
                        <td className="p-3 font-semibold tabular-nums">
                          {variant.stock}
                          {variant.stock === 0 ? (
                            <span className="ml-2 text-xs text-red-800">Agotado</span>
                          ) : variant.stock <= threshold ? (
                            <span className="ml-2 text-xs text-amber-800">Stock bajo</span>
                          ) : null}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            <select
                              aria-label={`Operación de stock ${variant.sku}`}
                              value={input.mode}
                              onChange={(event) => {
                                setStockInputs({
                                  ...stockInputs,
                                  [variant.id]: {
                                    ...input,
                                    mode: event.currentTarget.value as RemoteStockAdjustmentMode,
                                  },
                                })
                              }}
                              className="min-h-9 rounded-md bg-white px-2 text-xs ring-1 ring-stone-900/15"
                            >
                              <option value="add">Añadir</option>
                              <option value="subtract">Restar</option>
                              <option value="set">Fijar total</option>
                            </select>
                            <input
                              aria-label={`Cantidad para ${variant.sku}`}
                              type="number"
                              min="0"
                              max="999999999"
                              step="1"
                              value={input.quantity}
                              onChange={(event) => {
                                setStockInputs({
                                  ...stockInputs,
                                  [variant.id]: { ...input, quantity: event.currentTarget.value },
                                })
                              }}
                              className="min-h-9 w-20 rounded-md px-2 text-sm ring-1 ring-stone-900/15"
                            />
                            <input
                              aria-label={`Nota para ${variant.sku}`}
                              maxLength={300}
                              placeholder="Nota (opcional)"
                              value={input.note}
                              onChange={(event) => {
                                setStockInputs({
                                  ...stockInputs,
                                  [variant.id]: { ...input, note: event.currentTarget.value },
                                })
                              }}
                              className="min-h-9 w-32 rounded-md px-2 text-xs ring-1 ring-stone-900/15"
                            />
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={busyVariantId === variant.id}
                              onClick={() => void saveStock(variant.id)}
                              className={buttonClassName('secondary', 'py-1.5 disabled:opacity-45')}
                            >
                              {busyVariantId === variant.id ? '…' : 'Guardar stock'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                startEditProduct(product.id)
                              }}
                              className={buttonClassName('secondary', 'py-1.5')}
                            >
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr key={product.id}>
                    <td className="p-3">
                      <strong>{product.name}</strong>
                      <span className="ml-2 text-xs text-red-800">Sin variantes</span>
                    </td>
                    <td className="p-3">{product.active ? 'Publicado' : 'Oculto'}</td>
                    <td className="p-3">—</td>
                    <td className="p-3">Añade una variante desde la importación CSV.</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => {
                          startEditProduct(product.id)
                        }}
                        className={buttonClassName('secondary', 'py-1.5')}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-5 text-center text-sm text-stone-500">
                    No hay productos que coincidan con estos filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
