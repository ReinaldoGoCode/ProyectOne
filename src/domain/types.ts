/**
 * Tipos del dominio de Norte Moda.
 *
 * Reglas de este archivo:
 * - Sin dependencias de React, Vite ni Supabase.
 * - Todo es `readonly`: el dominio describe datos, no mutaciones.
 * - El dinero siempre se expresa en centavos enteros (`priceCents`,
 *   `subtotalCents`, `totalCents`). Nunca en unidades con decimales.
 */

export type CategoryId = string
export type ProductId = string
export type VariantId = string

/** Tallas disponibles en la tienda. */
export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'Único'

export interface Category {
  readonly id: CategoryId
  readonly slug: string
  readonly name: string
  readonly description: string
}

export interface Product {
  readonly id: ProductId
  readonly slug: string
  readonly name: string
  readonly categoryId: CategoryId
  readonly description: string
  readonly composition: string
  readonly care: string
  /** Precio de venta en centavos de dólar. */
  readonly priceCents: number
  readonly imageUrl: string
  readonly imageAlt: string
  readonly active: boolean
  /** Fecha ISO 8601; se usa para ordenar por novedad. */
  readonly createdAt: string
}

/**
 * Combinación vendible de un producto: talla + color.
 * `stock` es la cantidad disponible y nunca puede ser negativa.
 */
export interface Variant {
  readonly id: VariantId
  readonly productId: ProductId
  readonly size: Size
  readonly color: string
  readonly sku: string
  readonly stock: number
}

export type InventoryMovementReason = 'receipt' | 'sale' | 'adjustment' | 'import'

/** A durable local demo record for every stock change. Positive delta adds units. */
export interface InventoryMovement {
  readonly id: string
  readonly variantId: VariantId | null
  readonly sku: string
  readonly productName: string
  readonly size: Size
  readonly color: string
  readonly delta: number
  readonly reason: InventoryMovementReason
  readonly note: string | null
  readonly orderId: string | null
  readonly createdAt: string
}

/** Catálogo completo en memoria: lo que hoy viene del seed y mañana de Supabase. */
export interface Catalog {
  readonly categories: readonly Category[]
  readonly products: readonly Product[]
  readonly variants: readonly Variant[]
}

/**
 * Línea del carrito. Guarda solo la variante y la cantidad: el precio se
 * resuelve contra el catálogo para no confiar en datos del cliente.
 */
export interface CartLine {
  readonly variantId: VariantId
  readonly quantity: number
}

export type PaymentStatus = 'pendiente' | 'por_verificar' | 'pagado' | 'rechazado' | 'cancelado'

export type FulfillmentStatus = 'nuevo' | 'preparando' | 'despachado' | 'entregado' | 'cancelado'

export type OrderStatus = 'awaiting_payment' | 'confirmed' | 'inventory_exception' | 'cancelled'

export interface ExchangeQuote {
  /** Rate in VES per USD. Decimal text avoids floating point persistence. */
  readonly vesPerUsd: string
  readonly source: 'demo_ficticia' | 'bcv'
  readonly quotedAt: string
  readonly expiresAt: string
  /** Immutable BCV publication metadata captured with remote orders. */
  readonly effectiveDate?: string | undefined
  readonly sourceUrl?: string | undefined
  readonly retrievedAt?: string | undefined
}

export type PaymentMethod =
  'pago_movil' | 'transferencia' | 'efectivo' | 'efectivo_ves' | 'efectivo_usd'

export type DeliveryMethod = 'delivery_local' | 'envio_nacional' | 'retiro'

export interface Customer {
  readonly firstName: string
  readonly lastName: string
  readonly phone: string
  /** Sin correo si el comprador no lo dejó. */
  readonly email: string | null
}

export interface ShippingAddress {
  readonly state: string
  readonly city: string
  readonly addressLine: string
  readonly reference: string
}

/**
 * Línea congelada de un pedido. Copia nombre, talla, color y precio del
 * momento de la compra: el pedido es un hecho histórico y no debe cambiar
 * si el producto se edita después.
 */
export interface OrderItem {
  readonly productId: ProductId
  readonly variantId: VariantId
  readonly productName: string
  readonly size: Size
  readonly color: string
  readonly unitPriceCents: number
  readonly quantity: number
}

export interface OrderNote {
  readonly id: string
  readonly at: string
  readonly body: string
}

/**
 * Cambio de estado en pedido, pago o entrega. `from` es `null`
 * únicamente en el evento de creación.
 */
export type OrderStatusEvent =
  | {
      readonly axis: 'payment'
      readonly id: string
      readonly at: string
      readonly from: PaymentStatus | null
      readonly to: PaymentStatus
      readonly note: string | null
    }
  | {
      readonly axis: 'fulfillment'
      readonly id: string
      readonly at: string
      readonly from: FulfillmentStatus | null
      readonly to: FulfillmentStatus
      readonly note: string | null
    }
  | {
      readonly axis: 'order'
      readonly id: string
      readonly at: string
      readonly from: OrderStatus | null
      readonly to: OrderStatus
      readonly note: string | null
    }

export interface Order {
  readonly id: string
  /** Código legible que el comprador usa para consultar su pedido, ej. `NM-0001`. */
  readonly code: string
  readonly createdAt: string
  readonly customer: Customer
  readonly deliveryMethod: DeliveryMethod
  /** Solo aplica a `envio_nacional`; en los demás casos es `null`. */
  readonly shippingAddress: ShippingAddress | null
  /** Agencia escrita por el comprador; sin integración con MRW ni ZOOM. */
  readonly shippingAgency: string | null
  /** Datos de despacho registrados manualmente por la tienda. */
  readonly shippingCompany?: string | null | undefined
  readonly shippingTrackingNumber?: string | null | undefined
  readonly shippingNotes?: string | null | undefined
  readonly paymentMethod: PaymentMethod
  /** Public method instructions captured at checkout; absent on older local orders. */
  readonly paymentInstructions?: string | null | undefined
  readonly paymentReference: string | null
  /** Nota que dejó el comprador al crear el pedido. */
  readonly customerNote: string | null
  readonly items: readonly OrderItem[]
  readonly subtotalCents: number
  readonly shippingCents: number
  readonly totalCents: number
  readonly exchangeQuote?: ExchangeQuote | undefined
  readonly orderStatus: OrderStatus
  readonly paymentStatus: PaymentStatus
  readonly fulfillmentStatus: FulfillmentStatus
  readonly notes: readonly OrderNote[]
  readonly history: readonly OrderStatusEvent[]
}
