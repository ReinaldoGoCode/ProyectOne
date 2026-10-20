import { describe, expect, it } from 'vitest'

import type { CartLineDetail } from '../cart'
import {
  appendOrderNote,
  canTransitionFulfillment,
  canTransitionPayment,
  createOrder,
  createOrderItems,
  findOrderByCode,
  getAllowedFulfillmentTransitions,
  getAllowedPaymentTransitions,
  nextOrderCode,
  transitionFulfillmentStatus,
  transitionPaymentStatus,
} from '../order'
import type { Customer, Order, OrderItem, Product, Variant } from '../types'

const CUSTOMER: Customer = {
  firstName: 'Ana',
  lastName: 'Pérez',
  phone: '+58 412 123 4567',
  email: null,
}

const FIRST_ITEM: OrderItem = {
  productId: 'camisa',
  variantId: 'camisa-m-arena',
  productName: 'Camisa de lino',
  size: 'M',
  color: 'Arena',
  unitPriceCents: 2800,
  quantity: 2,
}

const SECOND_ITEM: OrderItem = {
  productId: 'vestido',
  variantId: 'vestido-s-negro',
  productName: 'Vestido corto',
  size: 'S',
  color: 'Negro',
  unitPriceCents: 3400,
  quantity: 1,
}

const ITEMS: readonly OrderItem[] = [FIRST_ITEM, SECOND_ITEM]

const ORDER_INPUT = {
  code: 'nm-0001',
  customer: CUSTOMER,
  deliveryMethod: 'envio_nacional',
  shippingAddress: {
    state: 'Miranda',
    city: 'Los Teques',
    addressLine: 'Calle Sucre, casa 4',
    reference: 'Frente a la plaza',
  },
  shippingAgency: 'MRW',
  paymentMethod: 'pago_movil',
  paymentReference: '1234',
  customerNote: 'Entregar después de las 5',
  items: ITEMS,
  shippingCents: 500,
} as const

function sampleOrder(): Order {
  return createOrder(ORDER_INPUT)
}

describe('createOrder', () => {
  it('calcula subtotal y total y normaliza el código', () => {
    const order = sampleOrder()

    expect(order.code).toBe('NM-0001')
    expect(order.subtotalCents).toBe(9000)
    expect(order.shippingCents).toBe(500)
    expect(order.totalCents).toBe(9500)
  })

  it('inicializa pago y entrega con historial separado', () => {
    const order = sampleOrder()

    expect(order.paymentStatus).toBe('pendiente')
    expect(order.fulfillmentStatus).toBe('nuevo')
    expect(order.history).toHaveLength(2)
    expect(order.history.map((event) => event.axis)).toEqual(['payment', 'fulfillment'])
    expect(order.notes).toEqual([])
  })

  it('conserva los datos congelados de las líneas', () => {
    const order = sampleOrder()

    expect(order.items[0]?.productName).toBe('Camisa de lino')
    expect(order.items[0]?.unitPriceCents).toBe(2800)
    expect(order.customerNote).toBe('Entregar después de las 5')
  })

  it('rechaza pedidos sin líneas o con cantidades inválidas', () => {
    expect(() => createOrder({ ...ORDER_INPUT, items: [] })).toThrow(RangeError)
    expect(() =>
      createOrder({
        ...ORDER_INPUT,
        items: [{ ...FIRST_ITEM, quantity: 0 }],
      }),
    ).toThrow(RangeError)
  })
})

describe('createOrderItems', () => {
  it('copia nombre, variante y precio del catálogo actual', () => {
    const product: Product = {
      id: 'camisa',
      slug: 'camisa',
      name: 'Camisa de lino',
      categoryId: 'camisas',
      description: '',
      composition: '',
      care: '',
      priceCents: 2800,
      imageUrl: '/x.svg',
      imageAlt: '',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const variant: Variant = {
      id: 'camisa-m-arena',
      productId: 'camisa',
      size: 'M',
      color: 'Arena',
      sku: 'CAM-M-ARENA',
      stock: 4,
    }
    const details: readonly CartLineDetail[] = [
      { product, variant, quantity: 2, lineTotalCents: 5600, maxQuantity: 4 },
    ]

    expect(createOrderItems(details)).toEqual([
      {
        productId: 'camisa',
        variantId: 'camisa-m-arena',
        productName: 'Camisa de lino',
        size: 'M',
        color: 'Arena',
        unitPriceCents: 2800,
        quantity: 2,
      },
    ])
  })
})

describe('códigos de pedido', () => {
  it('genera el siguiente código a partir del máximo existente', () => {
    expect(nextOrderCode([])).toBe('NM-0001')
    expect(nextOrderCode([{ ...sampleOrder(), code: 'NM-0007' }])).toBe('NM-0008')
    expect(nextOrderCode([{ ...sampleOrder(), code: 'NM-0012' }])).toBe('NM-0013')
  })

  it('busca sin distinguir mayúsculas ni espacios', () => {
    const order = sampleOrder()

    expect(findOrderByCode([order], ' nm-0001 ')?.id).toBe(order.id)
    expect(findOrderByCode([order], 'NM-9999')).toBeUndefined()
  })
})

describe('transiciones de estado', () => {
  it('permite las transiciones definidas y bloquea las inválidas', () => {
    expect(canTransitionPayment('pendiente', 'por_verificar')).toBe(true)
    expect(canTransitionPayment('pendiente', 'pagado')).toBe(false)
    expect(canTransitionFulfillment('nuevo', 'preparando')).toBe(true)
    expect(canTransitionFulfillment('entregado', 'nuevo')).toBe(false)

    expect(getAllowedPaymentTransitions('por_verificar')).toEqual([
      'pagado',
      'rechazado',
      'cancelado',
    ])
    expect(getAllowedFulfillmentTransitions('despachado')).toEqual(['entregado'])
  })

  it('agrega un evento al historial sin modificar los anteriores', () => {
    const order = sampleOrder()
    const updated = transitionPaymentStatus(order, 'por_verificar', '  Comprobante recibido  ')

    expect(updated.paymentStatus).toBe('por_verificar')
    expect(updated.history).toHaveLength(3)
    expect(updated.history[0]).toEqual(order.history[0])
    expect(updated.history[2]?.note).toBe('Comprobante recibido')
  })

  it('rechaza transiciones inválidas sin tocar el pedido', () => {
    const order = sampleOrder()

    expect(() => transitionPaymentStatus(order, 'pagado')).toThrow(RangeError)
    expect(() => transitionFulfillmentStatus(order, 'entregado')).toThrow(RangeError)
    expect(order.history).toHaveLength(2)
  })

  it('mantiene los dos ejes independientes', () => {
    const paid = transitionPaymentStatus(sampleOrder(), 'por_verificar')
    const preparing = transitionFulfillmentStatus(paid, 'preparando')

    expect(preparing.paymentStatus).toBe('por_verificar')
    expect(preparing.fulfillmentStatus).toBe('preparando')
  })
})

describe('appendOrderNote', () => {
  it('agrega una nota interna con fecha', () => {
    const order = appendOrderNote(sampleOrder(), '  Enviar por MRW  ', '2026-10-19T20:00:00.000Z')

    expect(order.notes).toHaveLength(1)
    expect(order.notes[0]?.body).toBe('Enviar por MRW')
    expect(order.notes[0]?.at).toBe('2026-10-19T20:00:00.000Z')
  })

  it('rechaza notas vacías', () => {
    expect(() => appendOrderNote(sampleOrder(), '   ')).toThrow(RangeError)
  })
})
