import { useState } from 'react'
import type { SyntheticEvent } from 'react'

import { useCatalog } from '@/app/providers/catalogContext'
import type { ProductInput, VariantInput } from '@/app/providers/catalogContext'
import { buttonClassName } from '@/components/ui/button'
import { formatMoney, toCents } from '@/domain/money'
import type { Product, Size } from '@/domain/types'

const SIZES: readonly Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único']

interface ProductFormState {
  name: string
  categoryId: string
  description: string
  composition: string
  care: string
  price: string
  active: boolean
}

const EMPTY_PRODUCT: ProductFormState = {
  name: '',
  categoryId: '',
  description: '',
  composition: '',
  care: '',
  price: '',
  active: true,
}

interface VariantFormState {
  id?: string
  productId: string
  size: Size
  color: string
  sku: string
  stock: string
}

const EMPTY_VARIANT: VariantFormState = {
  productId: '',
  size: 'S',
  color: '',
  sku: '',
  stock: '0',
}

function productInput(form: ProductFormState): ProductInput {
  const price = Number(form.price.replace(',', '.'))
  return {
    name: form.name,
    categoryId: form.categoryId,
    description: form.description,
    composition: form.composition,
    care: form.care,
    priceCents: toCents(price),
    active: form.active,
  }
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  ...props
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  min?: string
  step?: string
}) {
  const id = `admin-${label.toLowerCase().replaceAll(' ', '-')}`
  return (
    <label htmlFor={id} className="block text-xs font-medium text-stone-600">
      {label}
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(event) => {
          onChange(event.currentTarget.value)
        }}
        className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm text-ink ring-1 ring-stone-900/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        {...props}
      />
    </label>
  )
}

export function ProductAdmin() {
  const { catalog, createProduct, updateProduct, setProductActive, saveVariant, deleteVariant } =
    useCatalog()
  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [variant, setVariant] = useState<VariantFormState>(EMPTY_VARIANT)
  const [variantEditingId, setVariantEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  const selectedProduct = catalog.products.find((item) => item.id === selectedProductId)
  const selectedVariants = catalog.variants.filter((item) => item.productId === selectedProductId)

  function editProduct(product: Product): void {
    setEditingId(product.id)
    setSelectedProductId(product.id)
    setVariant({ ...EMPTY_VARIANT, productId: product.id })
    setForm({
      name: product.name,
      categoryId: product.categoryId,
      description: product.description,
      composition: product.composition,
      care: product.care,
      price: (product.priceCents / 100).toFixed(2),
      active: product.active,
    })
    setError('')
    setSaved('')
  }

  function submitProduct(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault()
    setError('')
    setSaved('')
    try {
      const input = productInput(form)
      const product = editingId
        ? (updateProduct(editingId, input), catalog.products.find((item) => item.id === editingId))
        : createProduct(input)
      const id = product?.id ?? editingId
      if (id) {
        setSelectedProductId(id)
        setVariant({ ...EMPTY_VARIANT, productId: id })
      }
      setForm(EMPTY_PRODUCT)
      setEditingId(null)
      setSaved(editingId ? 'Producto actualizado.' : 'Producto creado. Ahora añade sus variantes.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el producto.')
    }
  }

  function beginVariantEdit(item: (typeof selectedVariants)[number]): void {
    setVariantEditingId(item.id)
    setVariant({
      id: item.id,
      productId: item.productId,
      size: item.size,
      color: item.color,
      sku: item.sku,
      stock: String(item.stock),
    })
    setError('')
  }

  function submitVariant(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault()
    setError('')
    setSaved('')
    try {
      const input: VariantInput = {
        ...(variantEditingId ? { id: variantEditingId } : {}),
        productId: variant.productId,
        size: variant.size,
        color: variant.color,
        sku: variant.sku,
        stock: Number(variant.stock),
      }
      saveVariant(input)
      setVariant({ ...EMPTY_VARIANT, productId: selectedProductId })
      setVariantEditingId(null)
      setSaved(variantEditingId ? 'Variante actualizada.' : 'Variante añadida.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar la variante.')
    }
  }

  function updateForm<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateVariant<K extends keyof VariantFormState>(
    key: K,
    value: VariantFormState[K],
  ): void {
    setVariant((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-medium">Productos ({catalog.products.length})</h2>
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setForm(EMPTY_PRODUCT)
              setError('')
            }}
            className={buttonClassName('secondary')}
          >
            Nuevo producto
          </button>
        </div>
        <ul className="mt-4 divide-y divide-stone-900/10 rounded-2xl border border-stone-900/10 bg-white/50">
          {catalog.products.length === 0 ? (
            <li className="p-5 text-sm text-stone-500">No hay productos. Crea el primero.</li>
          ) : (
            catalog.products.map((product) => (
              <li
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {formatMoney(product.priceCents)} ·{' '}
                    {catalog.variants.filter((item) => item.productId === product.id).length}{' '}
                    variantes · {product.active ? 'Activo' : 'Pausado'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      editProduct(product)
                    }}
                    className="rounded-full px-3 py-2 text-xs ring-1 ring-stone-900/15 hover:bg-white"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProductActive(product.id, !product.active)
                    }}
                    className="rounded-full px-3 py-2 text-xs ring-1 ring-stone-900/15 hover:bg-white"
                  >
                    {product.active ? 'Pausar' : 'Activar'}
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>

        <form
          onSubmit={submitProduct}
          className="mt-6 rounded-2xl bg-white/60 p-5 ring-1 ring-stone-900/10 sm:p-6"
        >
          <h3 className="text-lg font-medium">
            {editingId ? 'Editar producto' : 'Crear producto'}
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Nombre"
              value={form.name}
              required
              onChange={(value) => {
                updateForm('name', value)
              }}
            />
            <label className="block text-xs font-medium text-stone-600">
              Categoría
              <select
                required
                value={form.categoryId}
                onChange={(event) => {
                  updateForm('categoryId', event.currentTarget.value)
                }}
                className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm ring-1 ring-stone-900/12"
              >
                <option value="">Elige una categoría</option>
                {catalog.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Precio USD"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.price}
              onChange={(value) => {
                updateForm('price', value)
              }}
            />
            <Field
              label="Composición"
              value={form.composition}
              onChange={(value) => {
                updateForm('composition', value)
              }}
            />
            <label className="block text-xs font-medium text-stone-600 sm:col-span-2">
              Descripción
              <textarea
                value={form.description}
                onChange={(event) => {
                  updateForm('description', event.currentTarget.value)
                }}
                rows={3}
                className="mt-1.5 w-full rounded-xl bg-white p-3 text-sm ring-1 ring-stone-900/12"
              />
            </label>
            <label className="block text-xs font-medium text-stone-600 sm:col-span-2">
              Cuidados
              <textarea
                value={form.care}
                onChange={(event) => {
                  updateForm('care', event.currentTarget.value)
                }}
                rows={2}
                className="mt-1.5 w-full rounded-xl bg-white p-3 text-sm ring-1 ring-stone-900/12"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => {
                  updateForm('active', event.currentTarget.checked)
                }}
              />
              Mostrar en el catálogo
            </label>
          </div>
          {error ? (
            <p role="alert" className="mt-4 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p aria-live="polite" className="mt-4 text-sm text-emerald-800">
              {saved}
            </p>
          ) : null}
          <button type="submit" className={buttonClassName('primary', 'mt-5')}>
            {editingId ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-medium">Variantes y stock</h2>
        <label className="mt-4 block text-xs font-medium text-stone-600">
          Producto
          <select
            value={selectedProductId}
            onChange={(event) => {
              setSelectedProductId(event.currentTarget.value)
              setVariant({ ...EMPTY_VARIANT, productId: event.currentTarget.value })
              setVariantEditingId(null)
            }}
            className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm ring-1 ring-stone-900/12"
          >
            <option value="">Elige un producto</option>
            {catalog.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>

        {selectedProduct ? (
          <>
            {selectedVariants.length === 0 ? (
              <p className="mt-4 rounded-xl bg-white/60 p-4 text-sm text-stone-500">
                Este producto aún no tiene variantes.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-900/10 bg-white/50">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="border-b border-stone-900/10 text-xs text-stone-500">
                    <tr>
                      <th className="p-3">Talla</th>
                      <th className="p-3">Color</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Stock</th>
                      <th className="p-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-900/8">
                    {selectedVariants.map((item) => (
                      <tr key={item.id}>
                        <td className="p-3">{item.size}</td>
                        <td className="p-3">{item.color}</td>
                        <td className="p-3 font-mono text-xs">{item.sku}</td>
                        <td className="p-3 tabular-nums">{item.stock}</td>
                        <td className="p-3">
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                beginVariantEdit(item)
                              }}
                              className="text-xs underline underline-offset-4"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                deleteVariant(item.id)
                                setSaved('Variante eliminada.')
                              }}
                              className="text-xs text-red-800 underline underline-offset-4"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form
              onSubmit={submitVariant}
              className="mt-5 rounded-2xl bg-white/60 p-5 ring-1 ring-stone-900/10"
            >
              <h3 className="font-medium">
                {variantEditingId ? 'Editar variante' : 'Añadir variante'}
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-stone-600">
                  Talla
                  <select
                    value={variant.size}
                    onChange={(event) => {
                      updateVariant('size', event.currentTarget.value as Size)
                    }}
                    className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm ring-1 ring-stone-900/12"
                  >
                    {SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Color"
                  value={variant.color}
                  required
                  onChange={(value) => {
                    updateVariant('color', value)
                  }}
                />
                <Field
                  label="SKU"
                  value={variant.sku}
                  required
                  onChange={(value) => {
                    updateVariant('sku', value)
                  }}
                />
                <Field
                  label="Stock"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={variant.stock}
                  onChange={(value) => {
                    updateVariant('stock', value)
                  }}
                />
              </div>
              {error ? (
                <p role="alert" className="mt-4 text-sm text-red-800">
                  {error}
                </p>
              ) : null}
              <button type="submit" className={buttonClassName('primary', 'mt-5')}>
                {variantEditingId ? 'Guardar variante' : 'Añadir variante'}
              </button>
              {variantEditingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setVariant({ ...EMPTY_VARIANT, productId: selectedProductId })
                    setVariantEditingId(null)
                  }}
                  className="ml-3 text-sm text-stone-600 underline underline-offset-4"
                >
                  Cancelar
                </button>
              ) : null}
            </form>
          </>
        ) : (
          <p className="mt-4 rounded-2xl bg-white/60 p-5 text-sm text-stone-500">
            Crea o elige un producto para gestionar sus variantes.
          </p>
        )}
      </section>
    </div>
  )
}
