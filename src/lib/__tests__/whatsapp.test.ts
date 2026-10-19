import { describe, expect, it } from 'vitest'

import type { Customer, OrderItem } from '@/domain/types'

import {
  STORE_WHATSAPP_NUMBER,
  buildOrderMessage,
  buildOrderWhatsAppUrl,
  buildProductInquiryMessage,
  buildProductInquiryUrl,
  buildWhatsAppUrl,
} from '../whatsapp'

const CUSTOMER: Customer = {
  firstName: 'Ana',
  lastName: 'Pérez',
  idNumber: 'V-12345678',
  phone: '+58 412 123 4567',
  email: null,
}

const ITEMS: readonly OrderItem[] = [
  {
    productId: 'camisa-lino-margarita',
    variantId: 'camisa-lino-margarita-arena-m',
    productName: 'Camisa de lino Margarita',
    size: 'M',
    color: 'Arena',
    unitPriceCents: 2800,
    quantity: 2,
  },
  {
    productId: 'vestido-corto-paraguana',
    variantId: 'vestido-corto-paraguana-negro-s',
    productName: 'Vestido corto Paraguaná',
    size: 'S',
    color: 'Negro',
    unitPriceCents: 3400,
    quantity: 1,
  },
]

const ORDER = {
  code: 'NM-0001',
  customer: CUSTOMER,
  items: ITEMS,
  paymentMethod: 'pago_movil',
  deliveryMethod: 'envio_nacional',
  shippingAgency: 'MRW',
  totalCents: 9000,
  note: null,
} as const

describe('buildOrderMessage', () => {
  it('arma el pedido con negritas, líneas y total formateado', () => {
    expect(buildOrderMessage(ORDER)).toBe(
      [
        'Hola, quiero confirmar este pedido:',
        '',
        '*Norte Moda — Pedido NM-0001*',
        'Cliente: Ana Pérez · +58 412 123 4567',
        '',
        '*Prendas*',
        '• Camisa de lino Margarita',
        '  Talla M · Color Arena · ×2 · $56,00',
        '• Vestido corto Paraguaná',
        '  Talla S · Color Negro · ×1 · $34,00',
        '',
        '*Pago:* Pago Móvil',
        '*Entrega:* Envío nacional · MRW',
        '*Total:* $90,00',
      ].join('\n'),
    )
  })

  it('omite la agencia cuando el pedido es retiro en tienda', () => {
    const message = buildOrderMessage({
      ...ORDER,
      deliveryMethod: 'retiro',
      shippingAgency: null,
    })

    expect(message).toContain('*Entrega:* Retiro en tienda')
    expect(message).not.toContain('MRW')
  })

  it('incluye la nota interna cuando existe', () => {
    const message = buildOrderMessage({ ...ORDER, note: '  Entregar después de las 5  ' })

    expect(message).toContain('*Nota:* Entregar después de las 5')
  })

  it('rechaza pedidos sin código o sin prendas', () => {
    expect(() => buildOrderMessage({ ...ORDER, code: '  ' })).toThrow(RangeError)
    expect(() => buildOrderMessage({ ...ORDER, items: [] })).toThrow(RangeError)
  })
})

describe('buildWhatsAppUrl', () => {
  it('usa el número de la tienda y escapa el mensaje', () => {
    const message = buildOrderMessage(ORDER)
    const url = buildWhatsAppUrl(message)

    expect(url.startsWith(`https://wa.me/${STORE_WHATSAPP_NUMBER}?text=`)).toBe(true)
    expect(url).not.toContain(' ')
    expect(url).not.toContain('\n')

    const encoded = url.split('?text=')[1]
    expect(encoded).toBeDefined()
    expect(decodeURIComponent(encoded ?? '')).toBe(message)
  })

  it('normaliza un número escrito con signos y espacios', () => {
    const url = buildWhatsAppUrl('Hola', '+58 (412) 555-0134')

    expect(url.startsWith('https://wa.me/584125550134?text=')).toBe(true)
  })

  it('rechaza números demasiado cortos', () => {
    expect(() => buildWhatsAppUrl('Hola', '123')).toThrow(RangeError)
  })
})

describe('buildProductInquiryMessage', () => {
  const INQUIRY = {
    productName: 'Camisa de lino Margarita',
    size: 'M',
    color: 'Arena',
    priceCents: 2800,
  } as const

  it('incluye prenda, variante y precio', () => {
    expect(buildProductInquiryMessage(INQUIRY)).toBe(
      [
        'Hola, me interesa esta prenda:',
        '',
        '*Camisa de lino Margarita*',
        'Talla M · Color Arena',
        'Precio: $28,00',
        '',
        '¿Me confirmas disponibilidad y forma de envío?',
      ].join('\n'),
    )
  })

  it('genera una URL decodificable', () => {
    const url = buildProductInquiryUrl(INQUIRY)
    const encoded = url.split('?text=')[1]

    expect(decodeURIComponent(encoded ?? '')).toBe(buildProductInquiryMessage(INQUIRY))
  })
})

describe('buildOrderWhatsAppUrl', () => {
  it('combina el mensaje del pedido con el enlace', () => {
    const url = buildOrderWhatsAppUrl(ORDER)
    const encoded = url.split('?text=')[1]

    expect(decodeURIComponent(encoded ?? '')).toBe(buildOrderMessage(ORDER))
  })
})
