import { describe, expect, it } from 'vitest'

import {
  analyzeWhatsAppMessage,
  composeWhatsAppReply,
  EMPTY_WHATSAPP_CONVERSATION_STATE,
} from '@/lib/whatsappAssistant'
import type { WhatsAppCatalogProductFact, WhatsAppOrderSummaryFact } from '@/lib/whatsappAssistant'

const CATALOG: readonly WhatsAppCatalogProductFact[] = [
  {
    slug: 'camisa-lino',
    name: 'Camisa de lino',
    category: 'Camisas',
    description: 'Camisa fresca de corte amplio para el día.',
    composition: 'Lino y algodón',
    priceCents: 2500,
    variants: [
      { id: 'shirt-m-green', size: 'M', color: 'Verde', stock: 3 },
      { id: 'shirt-l-white', size: 'L', color: 'Blanco', stock: 0 },
    ],
  },
  {
    slug: 'vestido-midi',
    name: 'Vestido midi',
    category: 'Vestidos',
    description: 'Vestido elegante para una salida casual.',
    composition: 'Rayón',
    priceCents: 4200,
    variants: [{ id: 'dress-s-blue', size: 'S', color: 'Azul', stock: 2 }],
  },
  {
    slug: 'blusa-seda',
    name: 'Blusa de seda',
    category: 'Blusas',
    description: 'Blusa clásica de manga corta.',
    composition: 'Seda',
    priceCents: 3100,
    variants: [{ id: 'blouse-m-black', size: 'M', color: 'Negro', stock: 0 }],
  },
]

const ORDER: WhatsAppOrderSummaryFact = {
  code: 'NM-0007',
  paymentStatus: 'review',
  orderStatus: 'confirmed',
  fulfillmentStatus: 'preparing',
  totalCents: 6700,
  vesTotalCents: 268000,
  vesPerUsd: '40.000000',
  exchangeSource: 'demo_ficticia',
  paymentInstructions: 'Pago Móvil: usa los datos que aparecen en el pedido.',
  paymentMethod: 'pago_movil',
  deliveryMethod: 'envio_nacional',
  shippingAgency: 'Agencia indicada por el cliente',
  shippingCents: 500,
}

describe('asistente conversacional conectado a datos del backend', () => {
  it('entiende preguntas naturales y errores tipográficos sobre el catálogo', () => {
    const analysis = analyzeWhatsAppMessage({
      text: 'Cuánto cuesta la camiza de lno?',
      state: EMPTY_WHATSAPP_CONVERSATION_STATE,
      products: CATALOG,
    })
    const reply = composeWhatsAppReply({ analysis, products: CATALOG, order: null })

    expect(analysis.intent).toBe('product_question')
    expect(analysis.productSlug).toBe('camisa-lino')
    expect(reply.message).toContain('$25,00 USD')
    expect(reply.message).toContain('3 unidades disponibles')
  })

  it('usa el producto recordado cuando el cliente hace una pregunta corta en el turno siguiente', () => {
    const analysis = analyzeWhatsAppMessage({
      text: '¿y talla M en verde?',
      state: { ...EMPTY_WHATSAPP_CONVERSATION_STATE, productSlug: 'camisa-lino' },
      products: CATALOG,
    })
    const reply = composeWhatsAppReply({ analysis, products: CATALOG, order: null })

    expect(analysis.intent).toBe('product_question')
    expect(analysis.size).toBe('M')
    expect(analysis.color).toBe('Verde')
    expect(reply.message).toContain('muestra 3 unidades disponibles')
  })

  it('recomienda solo variantes con existencia actual', () => {
    const analysis = analyzeWhatsAppMessage({
      text: 'Busco algo en talla S',
      state: EMPTY_WHATSAPP_CONVERSATION_STATE,
      products: CATALOG,
    })
    const reply = composeWhatsAppReply({ analysis, products: CATALOG, order: null })

    expect(analysis.intent).toBe('product_recommendation')
    expect(reply.message).toContain('Vestido midi')
    expect(reply.message).not.toContain('Blusa de seda')
  })

  it('compara datos actuales de dos productos identificados', () => {
    const analysis = analyzeWhatsAppMessage({
      text: '¿Qué diferencia hay entre la camisa de lino y el vestido midi?',
      state: EMPTY_WHATSAPP_CONVERSATION_STATE,
      products: CATALOG,
    })
    const reply = composeWhatsAppReply({ analysis, products: CATALOG, order: null })

    expect(analysis.intent).toBe('product_comparison')
    expect(reply.message).toContain('Camisa de lino')
    expect(reply.message).toContain('Vestido midi')
    expect(reply.message).toContain('$42,00 USD')
  })

  it('responde con instrucciones de pago congeladas en el pedido y no aprueba el pago', () => {
    const analysis = analyzeWhatsAppMessage({
      text: '¿Cómo pago mi pedido NM-0007?',
      state: EMPTY_WHATSAPP_CONVERSATION_STATE,
      products: CATALOG,
    })
    const reply = composeWhatsAppReply({ analysis, products: CATALOG, order: ORDER })

    expect(reply.message).toContain('en revisión manual')
    expect(reply.message).toContain('Pago Móvil: usa los datos')
    expect(reply.message).toContain('no confirma el pago')
    expect(reply.message).not.toContain('confirmado por la tienda')
  })

  it('registra una referencia como pendiente de revisión y nunca como pago aprobado', () => {
    const analysis = analyzeWhatsAppMessage({
      text: 'Referencia: AB-123456',
      state: { ...EMPTY_WHATSAPP_CONVERSATION_STATE, orderCode: ORDER.code },
      products: CATALOG,
    })
    const reply = composeWhatsAppReply({
      analysis,
      products: CATALOG,
      order: ORDER,
      paymentReferenceResult: 'submitted',
    })

    expect(analysis.intent).toBe('payment_reference')
    expect(reply.submitPaymentReference).toBe('AB-123456')
    expect(reply.message).toContain('pendiente de revisión manual')
    expect(reply.message).not.toContain('pago confirmado')
  })

  it('pide una sola información relevante para continuar con un comprobante', () => {
    const analysis = analyzeWhatsAppMessage({
      text: 'Ya hice la transferencia',
      state: { ...EMPTY_WHATSAPP_CONVERSATION_STATE, orderCode: ORDER.code },
      products: CATALOG,
    })
    const reply = composeWhatsAppReply({ analysis, products: CATALOG, order: ORDER })

    expect(analysis.intent).toBe('payment_reference')
    expect(reply.message).toContain('Envíame solo el número de referencia')
    expect(reply.message).toContain('no compartas claves')
  })

  it('mantiene las consultas de pedidos, pagos y atención humana bajo reglas deterministas', () => {
    const orderAnalysis = analyzeWhatsAppMessage({
      text: '¿Cómo va mi pedido NM-0007?',
      state: EMPTY_WHATSAPP_CONVERSATION_STATE,
      products: CATALOG,
      intentHint: { intent: 'product_recommendation' },
    })
    const paymentAnalysis = analyzeWhatsAppMessage({
      text: 'Referencia: AB-123456',
      state: { ...EMPTY_WHATSAPP_CONVERSATION_STATE, orderCode: ORDER.code },
      products: CATALOG,
      intentHint: { intent: 'product_search' },
    })
    const humanAnalysis = analyzeWhatsAppMessage({
      text: 'Quiero hablar con una persona',
      state: EMPTY_WHATSAPP_CONVERSATION_STATE,
      products: CATALOG,
      intentHint: { intent: 'product_question' },
    })

    expect(orderAnalysis.intent).toBe('delivery_status')
    expect(paymentAnalysis.intent).toBe('payment_reference')
    expect(humanAnalysis.intent).toBe('human_requested')
  })

  it('valida las talla y color sugeridos por IA contra las variantes reales', () => {
    const analysis = analyzeWhatsAppMessage({
      text: 'Busco la camisa de lino',
      state: EMPTY_WHATSAPP_CONVERSATION_STATE,
      products: CATALOG,
      intentHint: { size: 'XXXL', color: 'Dorado' },
    })

    expect(analysis.size).toBeNull()
    expect(analysis.color).toBeNull()
  })

  it('no inventa tarifas ni guías si solo existen valores de demostración', () => {
    const analysis = analyzeWhatsAppMessage({
      text: '¿Cuánto cuesta el envío por Zoom?',
      state: EMPTY_WHATSAPP_CONVERSATION_STATE,
      products: CATALOG,
    })
    const reply = composeWhatsAppReply({
      analysis,
      products: CATALOG,
      order: null,
      deliveryOptions: [{ method: 'envio_nacional', amountCents: 500, demoOnly: true }],
    })

    expect(analysis.intent).toBe('delivery_options')
    expect(reply.message).toContain('no tiene tarifas de entrega verificadas')
    expect(reply.message).toContain('No tenemos una conexión oficial con MRW o Zoom')
    expect(reply.message).not.toContain('$5,00')
  })

  it('permite consultar sin código solo pedidos asociados al teléfono verificado', () => {
    const analysis = analyzeWhatsAppMessage({
      text: '¿Cómo va mi pedido?',
      state: EMPTY_WHATSAPP_CONVERSATION_STATE,
      products: CATALOG,
    })
    const reply = composeWhatsAppReply({
      analysis,
      products: CATALOG,
      order: ORDER,
      matchingOrders: [ORDER],
    })

    expect(reply.message).toContain('El pedido NM-0007 está confirmado')
    expect(reply.message).toContain('Preparación y envío: en preparación')
  })

  it('informa solo los datos de despacho manual verificados para el pedido', () => {
    const analysis = analyzeWhatsAppMessage({
      text: '¿Dónde va mi envío NM-0007?',
      state: EMPTY_WHATSAPP_CONVERSATION_STATE,
      products: CATALOG,
    })
    const shipped: WhatsAppOrderSummaryFact = {
      ...ORDER,
      fulfillmentStatus: 'shipped',
      shippingCompany: 'MRW',
      shippingTrackingNumber: 'MRW-123456',
      shippingNotes: 'Sucursal centro',
    }
    const reply = composeWhatsAppReply({ analysis, products: CATALOG, order: shipped })

    expect(analysis.intent).toBe('delivery_status')
    expect(reply.message).toContain('Despacho manual: MRW · guía MRW-123456')
    expect(reply.message).toContain('Observaciones de envío: Sucursal centro')
    expect(reply.message).not.toContain('No hay un transportista')
  })

  it('respeta la solicitud de dejar de recibir mensajes sin enviar una respuesta', () => {
    const analysis = analyzeWhatsAppMessage({
      text: 'Por favor, no me contactes más',
      state: EMPTY_WHATSAPP_CONVERSATION_STATE,
      products: CATALOG,
    })
    const reply = composeWhatsAppReply({ analysis, products: CATALOG, order: null })

    expect(reply.optOut).toBe(true)
    expect(reply.message).toBe('')
  })
})
