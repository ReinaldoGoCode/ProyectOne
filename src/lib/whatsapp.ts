import { formatMoney, multiplyCents } from '@/domain/money'
import type { Customer, DeliveryMethod, OrderItem, PaymentMethod, Size } from '@/domain/types'

/**
 * Número ficticio de la tienda en formato internacional, sin `+` ni espacios.
 * Es el único lugar donde vive: cambiarlo aquí actualiza todos los enlaces.
 */
export const STORE_WHATSAPP_NUMBER = '584125550134'

const WHATSAPP_BASE_URL = 'https://wa.me'

const PAYMENT_LABELS: Readonly<Record<PaymentMethod, string>> = {
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia bancaria',
  efectivo: 'Efectivo',
}

const DELIVERY_LABELS: Readonly<Record<DeliveryMethod, string>> = {
  delivery_local: 'Delivery local',
  envio_nacional: 'Envío nacional',
  retiro: 'Retiro en tienda',
}

export interface OrderWhatsAppInput {
  readonly code: string
  readonly customer: Customer
  readonly items: readonly OrderItem[]
  readonly paymentMethod: PaymentMethod
  readonly deliveryMethod: DeliveryMethod
  readonly shippingAgency: string | null
  readonly totalCents: number
  readonly note: string | null
}

export interface ProductInquiryInput {
  readonly productName: string
  readonly size: Size
  readonly color: string
  readonly priceCents: number
}

/**
 * Construye el mensaje de un pedido con el markdown que entiende WhatsApp
 * (`*negrita*`). El pedido congela nombre, talla, color y precio de cada
 * línea, así que el mensaje no cambia si el catálogo se edita después.
 */
export function buildOrderMessage(input: OrderWhatsAppInput): string {
  const code = input.code.trim()

  if (code === '') {
    throw new RangeError('El pedido necesita un código para el mensaje')
  }

  if (input.items.length === 0) {
    throw new RangeError('El pedido necesita al menos una prenda')
  }

  const lines = input.items.map((item) => {
    const lineTotal = formatMoney(multiplyCents(item.unitPriceCents, item.quantity))

    return `• ${item.productName}\n  Talla ${item.size} · Color ${item.color} · ×${String(item.quantity)} · ${lineTotal}`
  })

  const agency = input.shippingAgency?.trim() ?? ''
  const delivery =
    input.deliveryMethod === 'envio_nacional' && agency !== ''
      ? `${DELIVERY_LABELS[input.deliveryMethod]} · ${agency}`
      : DELIVERY_LABELS[input.deliveryMethod]

  const note = input.note?.trim() ?? ''

  const blocks = [
    'Hola, quiero confirmar este pedido:',
    '',
    `*Norte Moda — Pedido ${code}*`,
    `Cliente: ${input.customer.firstName} ${input.customer.lastName} · ${input.customer.phone}`,
    '',
    '*Prendas*',
    ...lines,
    '',
    `*Pago:* ${PAYMENT_LABELS[input.paymentMethod]}`,
    `*Entrega:* ${delivery}`,
    `*Total:* ${formatMoney(input.totalCents)}`,
  ]

  if (note !== '') {
    blocks.push('', `*Nota:* ${note}`)
  }

  return blocks.join('\n')
}

export function buildProductInquiryMessage(input: ProductInquiryInput): string {
  return [
    'Hola, me interesa esta prenda:',
    '',
    `*${input.productName}*`,
    `Talla ${input.size} · Color ${input.color}`,
    `Precio: ${formatMoney(input.priceCents)}`,
    '',
    '¿Me confirmas disponibilidad y forma de envío?',
  ].join('\n')
}

/**
 * Genera un enlace `wa.me` con el texto escapado. `encodeURIComponent` cubre
 * saltos de línea, acentos, `#` y cualquier carácter que rompería la URL.
 */
export function buildWhatsAppUrl(message: string, phone: string = STORE_WHATSAPP_NUMBER): string {
  const normalizedPhone = phone.replace(/\D/g, '')

  if (normalizedPhone.length < 8) {
    throw new RangeError(`El número de WhatsApp no es válido. Recibido: ${phone}`)
  }

  return `${WHATSAPP_BASE_URL}/${normalizedPhone}?text=${encodeURIComponent(message)}`
}

export function buildOrderWhatsAppUrl(input: OrderWhatsAppInput): string {
  return buildWhatsAppUrl(buildOrderMessage(input))
}

export function buildProductInquiryUrl(input: ProductInquiryInput): string {
  return buildWhatsAppUrl(buildProductInquiryMessage(input))
}
