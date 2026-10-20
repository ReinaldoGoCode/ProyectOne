import type { DeliveryMethod, FulfillmentStatus, PaymentMethod, PaymentStatus } from './types'

export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia bancaria',
  efectivo: 'Efectivo',
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
