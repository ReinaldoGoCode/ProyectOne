import type { CartLineDetail } from './cart'
import { multiplyCents, sumCents } from './money'
import type {
  Customer,
  DeliveryMethod,
  ExchangeQuote,
  FulfillmentStatus,
  Order,
  OrderItem,
  OrderNote,
  OrderStatusEvent,
  PaymentMethod,
  PaymentStatus,
  ShippingAddress,
} from './types'

const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  pendiente: ['por_verificar', 'cancelado'],
  por_verificar: ['pagado', 'rechazado', 'cancelado'],
  pagado: [],
  rechazado: ['pendiente', 'cancelado'],
  cancelado: [],
}

const FULFILLMENT_TRANSITIONS: Readonly<Record<FulfillmentStatus, readonly FulfillmentStatus[]>> = {
  nuevo: ['preparando', 'cancelado'],
  preparando: ['despachado', 'cancelado'],
  despachado: ['entregado'],
  entregado: [],
  cancelado: [],
}

export function getAllowedPaymentTransitions(status: PaymentStatus): readonly PaymentStatus[] {
  return PAYMENT_TRANSITIONS[status]
}

export function getAllowedFulfillmentTransitions(
  status: FulfillmentStatus,
  order?: Pick<Order, 'paymentStatus' | 'orderStatus'>,
): readonly FulfillmentStatus[] {
  if (
    status === 'nuevo' &&
    (order?.paymentStatus !== 'pagado' || order.orderStatus !== 'confirmed')
  ) {
    return ['cancelado']
  }
  return FULFILLMENT_TRANSITIONS[status]
}

export function canTransitionPayment(status: PaymentStatus, next: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[status].includes(next)
}

export function canTransitionFulfillment(
  status: FulfillmentStatus,
  next: FulfillmentStatus,
  order?: Pick<Order, 'paymentStatus' | 'orderStatus'>,
): boolean {
  return getAllowedFulfillmentTransitions(status, order).includes(next)
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function normalizeOrderCode(code: string): string {
  return code.trim().toUpperCase()
}

export function findOrderByCode(orders: readonly Order[], code: string): Order | undefined {
  const normalized = normalizeOrderCode(code)
  return orders.find((order) => order.code === normalized)
}

/** Siguiente código legible: NM-0001, NM-0002... */
export function nextOrderCode(orders: readonly Order[]): string {
  let max = 0

  for (const order of orders) {
    const match = /^NM-(\d+)$/.exec(normalizeOrderCode(order.code))

    if (match?.[1] !== undefined) {
      max = Math.max(max, Number(match[1]))
    }
  }

  return `NM-${String(max + 1).padStart(4, '0')}`
}

export interface CreateOrderInput {
  readonly code: string
  readonly customer: Customer
  readonly deliveryMethod: DeliveryMethod
  readonly shippingAddress: ShippingAddress | null
  readonly shippingAgency: string | null
  readonly paymentMethod: PaymentMethod
  readonly paymentInstructions?: string | null
  readonly paymentReference: string | null
  readonly customerNote: string | null
  readonly items: readonly OrderItem[]
  readonly shippingCents: number
  readonly exchangeQuote?: ExchangeQuote
}

/**
 * Crea un pedido con los datos congelados de las líneas. El subtotal y el
 * total se calculan aquí, no se aceptan desde la interfaz.
 */
export function createOrder(input: CreateOrderInput): Order {
  const code = normalizeOrderCode(input.code)

  if (code === '') {
    throw new RangeError('El pedido necesita un código')
  }

  if (input.items.length === 0) {
    throw new RangeError('El pedido necesita al menos una prenda')
  }

  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new RangeError(`Cantidad inválida en ${item.productName}`)
    }
  }

  const createdAt = new Date().toISOString()
  const subtotalCents = sumCents(
    input.items.map((item) => multiplyCents(item.unitPriceCents, item.quantity)),
  )
  const totalCents = sumCents([subtotalCents, input.shippingCents])

  const history: readonly OrderStatusEvent[] = [
    {
      axis: 'order',
      id: createId('evt'),
      at: createdAt,
      from: null,
      to: 'awaiting_payment',
      note: 'Pedido creado; pendiente de pago',
    },
    {
      axis: 'payment',
      id: createId('evt'),
      at: createdAt,
      from: null,
      to: 'pendiente',
      note: 'Pedido creado',
    },
    {
      axis: 'fulfillment',
      id: createId('evt'),
      at: createdAt,
      from: null,
      to: 'nuevo',
      note: 'Pedido creado',
    },
  ]

  return {
    id: createId('order'),
    code,
    createdAt,
    customer: input.customer,
    deliveryMethod: input.deliveryMethod,
    shippingAddress: input.shippingAddress,
    shippingAgency: input.shippingAgency,
    paymentMethod: input.paymentMethod,
    paymentInstructions: input.paymentInstructions ?? null,
    paymentReference: input.paymentReference,
    customerNote: input.customerNote,
    items: input.items,
    subtotalCents,
    shippingCents: input.shippingCents,
    totalCents,
    ...(input.exchangeQuote ? { exchangeQuote: input.exchangeQuote } : {}),
    orderStatus: 'awaiting_payment',
    paymentStatus: 'pendiente',
    fulfillmentStatus: 'nuevo',
    notes: [],
    history,
  }
}

/** Convierte las líneas resueltas del carrito en líneas congeladas del pedido. */
export function createOrderItems(details: readonly CartLineDetail[]): readonly OrderItem[] {
  return details.map((detail) => ({
    productId: detail.product.id,
    variantId: detail.variant.id,
    productName: detail.product.name,
    size: detail.variant.size,
    color: detail.variant.color,
    unitPriceCents: detail.product.priceCents,
    quantity: detail.quantity,
  }))
}

function normalizedNote(note: string | null): string | null {
  const trimmed = note?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

export function transitionPaymentStatus(
  order: Order,
  next: PaymentStatus,
  note: string | null = null,
  at: string = new Date().toISOString(),
  options: { readonly inventoryAvailable?: boolean } = {},
): Order {
  if (!canTransitionPayment(order.paymentStatus, next)) {
    throw new RangeError(`Transición de pago inválida: ${order.paymentStatus} → ${next}`)
  }

  const event: OrderStatusEvent = {
    axis: 'payment',
    id: createId('evt'),
    at,
    from: order.paymentStatus,
    to: next,
    note: normalizedNote(note),
  }

  let orderStatus = order.orderStatus
  const events: OrderStatusEvent[] = [...order.history, event]
  if (next === 'pagado') {
    orderStatus = options.inventoryAvailable ? 'confirmed' : 'inventory_exception'
    events.push({
      axis: 'order',
      id: createId('evt'),
      at,
      from: order.orderStatus,
      to: orderStatus,
      note: options.inventoryAvailable
        ? 'Pago aprobado manualmente; stock comprobado.'
        : 'Pago aprobado manualmente; requiere resolver disponibilidad de inventario.',
    })
  } else if (next === 'cancelado') {
    orderStatus = 'cancelled'
    events.push({
      axis: 'order',
      id: createId('evt'),
      at,
      from: order.orderStatus,
      to: orderStatus,
      note: 'Pedido cancelado.',
    })
  }

  return {
    ...order,
    paymentStatus: next,
    orderStatus,
    history: events,
  }
}

export function transitionFulfillmentStatus(
  order: Order,
  next: FulfillmentStatus,
  note: string | null = null,
  at: string = new Date().toISOString(),
): Order {
  if (next === 'preparando' && !canTransitionFulfillment(order.fulfillmentStatus, next, order)) {
    throw new RangeError('Solo se puede preparar un pedido pagado y con stock confirmado.')
  }
  if (!canTransitionFulfillment(order.fulfillmentStatus, next, order)) {
    throw new RangeError(`Transición de entrega inválida: ${order.fulfillmentStatus} → ${next}`)
  }

  const event: OrderStatusEvent = {
    axis: 'fulfillment',
    id: createId('evt'),
    at,
    from: order.fulfillmentStatus,
    to: next,
    note: normalizedNote(note),
  }

  return {
    ...order,
    fulfillmentStatus: next,
    history: [...order.history, event],
  }
}

/** Resolves a paid order after the operator replenishes missing stock. */
export function resolveInventoryException(
  order: Order,
  inventoryAvailable: boolean,
  at: string = new Date().toISOString(),
): Order {
  if (order.paymentStatus !== 'pagado' || order.orderStatus !== 'inventory_exception') {
    throw new RangeError('El pedido no tiene una incidencia de inventario pendiente.')
  }
  if (!inventoryAvailable) {
    throw new RangeError('Todavía no hay stock suficiente para confirmar este pedido.')
  }
  const event: OrderStatusEvent = {
    axis: 'order',
    id: createId('evt'),
    at,
    from: 'inventory_exception',
    to: 'confirmed',
    note: 'Inventario revalidado y descontado por el administrador de la demo.',
  }
  return { ...order, orderStatus: 'confirmed', history: [...order.history, event] }
}

export function appendOrderNote(
  order: Order,
  body: string,
  at: string = new Date().toISOString(),
): Order {
  const trimmed = body.trim()

  if (trimmed === '') {
    throw new RangeError('La nota no puede estar vacía')
  }

  const note: OrderNote = {
    id: createId('note'),
    at,
    body: trimmed,
  }

  return { ...order, notes: [...order.notes, note] }
}
