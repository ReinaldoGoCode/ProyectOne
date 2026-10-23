import type {
  DeliveryMethod,
  FulfillmentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from './types'

export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia bancaria',
  efectivo: 'Sin pago · pedido de demostración',
  efectivo_ves: 'Efectivo en bolívares',
  efectivo_usd: 'Efectivo en dólares',
}

export const DELIVERY_METHOD_LABELS: Readonly<Record<DeliveryMethod, string>> = {
  delivery_local: 'Delivery local',
  envio_nacional: 'Envío nacional',
  retiro: 'Retiro en tienda',
}

export const PAYMENT_STATUS_LABELS: Readonly<Record<PaymentStatus, string>> = {
  pendiente: 'Pendiente',
  por_verificar: 'Por verificar',
  pagado: 'Pagado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
}

export const FULFILLMENT_STATUS_LABELS: Readonly<Record<FulfillmentStatus, string>> = {
  nuevo: 'Nuevo',
  preparando: 'Preparando',
  despachado: 'Despachado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  awaiting_payment: 'Pendiente de pago',
  confirmed: 'Confirmado',
  inventory_exception: 'Incidencia de inventario',
  cancelled: 'Cancelado',
}
