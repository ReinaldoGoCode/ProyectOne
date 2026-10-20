import { z } from 'zod'

import type { Catalog, Order } from '@/domain/types'

const SIZE_VALUES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único'] as const
const PAYMENT_STATUS_VALUES = [
  'pendiente',
  'por_verificar',
  'pagado',
  'rechazado',
  'cancelado',
] as const
const FULFILLMENT_STATUS_VALUES = [
  'nuevo',
  'preparando',
  'despachado',
  'entregado',
  'cancelado',
] as const
const PAYMENT_METHOD_VALUES = ['pago_movil', 'transferencia', 'efectivo'] as const
const DELIVERY_METHOD_VALUES = ['delivery_local', 'envio_nacional', 'retiro'] as const

const categorySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
})

const productSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  categoryId: z.string().min(1),
  description: z.string(),
  composition: z.string(),
  care: z.string(),
  priceCents: z.number().int().positive(),
  imageUrl: z.string().min(1),
  imageAlt: z.string(),
  active: z.boolean(),
  createdAt: z.string().min(1),
})

const variantSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  size: z.enum(SIZE_VALUES),
  color: z.string().min(1),
  sku: z.string().min(1),
  stock: z.number().int().nonnegative(),
})

export const catalogSchema = z
  .object({
    categories: z.array(categorySchema),
    products: z.array(productSchema),
    variants: z.array(variantSchema),
  })
  .superRefine((catalog, context) => {
    const categoryIds = new Set(catalog.categories.map((item) => item.id))
    const categorySlugs = new Set<string>()
    const productIds = new Set<string>()
    const productSlugs = new Set<string>()
    const variantIds = new Set<string>()
    const skus = new Set<string>()

    for (const category of catalog.categories) {
      if (categorySlugs.has(category.slug)) {
        context.addIssue({ code: 'custom', message: `Categoría duplicada: ${category.slug}` })
      }
      categorySlugs.add(category.slug)
    }
    for (const product of catalog.products) {
      if (productIds.has(product.id) || productSlugs.has(product.slug)) {
        context.addIssue({ code: 'custom', message: `Producto duplicado: ${product.id}` })
      }
      if (!categoryIds.has(product.categoryId)) {
        context.addIssue({ code: 'custom', message: `Categoría inexistente para ${product.id}` })
      }
      productIds.add(product.id)
      productSlugs.add(product.slug)
    }
    for (const variant of catalog.variants) {
      const sku = variant.sku.toUpperCase()
      if (variantIds.has(variant.id) || skus.has(sku)) {
        context.addIssue({ code: 'custom', message: `Variante o SKU duplicado: ${variant.id}` })
      }
      if (!productIds.has(variant.productId)) {
        context.addIssue({ code: 'custom', message: `Producto inexistente para ${variant.id}` })
      }
      variantIds.add(variant.id)
      skus.add(sku)
    }
  })

const customerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().nullable(),
})

const shippingAddressSchema = z.object({
  state: z.string(),
  city: z.string(),
  addressLine: z.string(),
  reference: z.string(),
})

const orderItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  productName: z.string().min(1),
  size: z.enum(SIZE_VALUES),
  color: z.string().min(1),
  unitPriceCents: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
})

const orderNoteSchema = z.object({
  id: z.string().min(1),
  at: z.string().min(1),
  body: z.string().min(1),
})

const paymentEventSchema = z.object({
  axis: z.literal('payment'),
  id: z.string().min(1),
  at: z.string().min(1),
  from: z.enum(PAYMENT_STATUS_VALUES).nullable(),
  to: z.enum(PAYMENT_STATUS_VALUES),
  note: z.string().nullable(),
})

const fulfillmentEventSchema = z.object({
  axis: z.literal('fulfillment'),
  id: z.string().min(1),
  at: z.string().min(1),
  from: z.enum(FULFILLMENT_STATUS_VALUES).nullable(),
  to: z.enum(FULFILLMENT_STATUS_VALUES),
  note: z.string().nullable(),
})

const orderStatusEventSchema = z.discriminatedUnion('axis', [
  paymentEventSchema,
  fulfillmentEventSchema,
])

export const orderSchema = z
  .object({
    id: z.string().min(1),
    code: z.string().min(1),
    createdAt: z.string().min(1),
    customer: customerSchema,
    deliveryMethod: z.enum(DELIVERY_METHOD_VALUES),
    shippingAddress: shippingAddressSchema.nullable(),
    shippingAgency: z.string().nullable(),
    paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
    paymentReference: z.string().nullable(),
    customerNote: z.string().nullable(),
    items: z.array(orderItemSchema).min(1),
    subtotalCents: z.number().int().nonnegative(),
    shippingCents: z.number().int().nonnegative(),
    totalCents: z.number().int().nonnegative(),
    paymentStatus: z.enum(PAYMENT_STATUS_VALUES),
    fulfillmentStatus: z.enum(FULFILLMENT_STATUS_VALUES),
    notes: z.array(orderNoteSchema),
    history: z.array(orderStatusEventSchema).min(1),
  })
  .superRefine((order, context) => {
    const subtotal = order.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
    if (!Number.isSafeInteger(subtotal) || subtotal !== order.subtotalCents) {
      context.addIssue({
        code: 'custom',
        path: ['subtotalCents'],
        message: 'El subtotal no coincide con los artículos.',
      })
    }
    if (order.totalCents !== order.subtotalCents + order.shippingCents) {
      context.addIssue({
        code: 'custom',
        path: ['totalCents'],
        message: 'El total no coincide con subtotal y entrega.',
      })
    }
    const paymentEvents = order.history.filter((event) => event.axis === 'payment')
    const fulfillmentEvents = order.history.filter((event) => event.axis === 'fulfillment')
    if (paymentEvents.at(-1)?.to !== order.paymentStatus) {
      context.addIssue({
        code: 'custom',
        path: ['paymentStatus'],
        message: 'El estado de pago no coincide con el historial.',
      })
    }
    if (fulfillmentEvents.at(-1)?.to !== order.fulfillmentStatus) {
      context.addIssue({
        code: 'custom',
        path: ['fulfillmentStatus'],
        message: 'El estado de entrega no coincide con el historial.',
      })
    }
  })

export const ordersSchema = z.array(orderSchema).superRefine((orders, context) => {
  const ids = new Set<string>()
  const codes = new Set<string>()
  for (const order of orders) {
    const code = order.code.trim().toUpperCase()
    if (ids.has(order.id) || codes.has(code)) {
      context.addIssue({ code: 'custom', message: `Pedido duplicado: ${code}` })
    }
    ids.add(order.id)
    codes.add(code)
  }
})

export function parseCatalog(value: unknown): Catalog | null {
  const result = catalogSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseOrders(value: unknown): readonly Order[] | null {
  const result = ordersSchema.safeParse(value)
  return result.success ? result.data : null
}
