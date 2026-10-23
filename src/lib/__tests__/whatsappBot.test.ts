import { describe, expect, it } from 'vitest'

import { routeWhatsAppMessage, routeWhatsAppPurchaseContext } from '@/lib/whatsappBot'
import type { WhatsAppOrderFacts } from '@/lib/whatsappBot'

const ORDER: WhatsAppOrderFacts = {
  code: 'NM-0007',
  orderStatus: 'confirmed',
  paymentStatus: 'review',
  fulfillmentStatus: 'preparing',
  totalCents: 7250,
  vesTotalCents: 290000,
  vesPerUsd: '40.000000',
  exchangeSource: 'demo_ficticia',
  paymentInstructions: null,
}

describe('asistente de WhatsApp determinista', () => {
  it('pide el código antes de consultar y no inventa estados', () => {
    const response = routeWhatsAppMessage('¿Cómo va mi pedido?', null)
    expect(response.message).toContain('NM-0001')
    expect(response.handoffReason).toBeNull()
  })

  it('solo contesta el estado recibido del backend', () => {
    const response = routeWhatsAppMessage('Estado de NM-0007', ORDER)
    expect(response.message).toContain('Pedido NM-0007: confirmado')
    expect(response.message).toContain('Pago: en revisión manual')
    expect(response.message).toContain('Entrega: en preparación')
    expect(response.message).not.toContain('aprobado')
  })

  it('no revela un código cuando no coincide con el teléfono', () => {
    const response = routeWhatsAppMessage('Estado NM-9000', null)
    expect(response.message).toContain('no voy a mostrar datos de otro cliente')
  })

  it('nunca aprueba pagos y deriva instrucciones ausentes a revisión humana', () => {
    const response = routeWhatsAppMessage('Necesito pagar NM-0007', ORDER)
    expect(response.message).toContain('no tiene instrucciones de pago configuradas')
    expect(response.message).toContain('solo lo confirma un administrador autorizado')
    expect(response.handoffReason).toBe('payment_instructions_missing')
  })

  it('comparte solo las instrucciones guardadas con el pedido y sigue sin aprobar el pago', () => {
    const response = routeWhatsAppMessage('¿Cómo pago NM-0007?', {
      ...ORDER,
      paymentInstructions: 'Transferencia a la cuenta que aparece en la orden.',
    })
    expect(response.message).toContain('Transferencia a la cuenta que aparece en la orden.')
    expect(response.message).toContain('Solo lo aprueba un administrador autorizado.')
    expect(response.handoffReason).toBeNull()
  })

  it('marca una solicitud explícita de una persona para la cola humana', () => {
    const response = routeWhatsAppMessage('Quiero hablar con un asesor', null)
    expect(response.handoffReason).toBe('human_requested')
  })

  it('escala preguntas que no puede resolver en vez de inventar', () => {
    const response = routeWhatsAppMessage('¿Cuándo llega la nueva colección?', null)
    expect(response.message).toContain('sin adivinar')
    expect(response.handoffReason).toBe('unknown_request')
  })

  it('responde con hechos de compra validados y guía al checkout sin crear el pedido', () => {
    const response = routeWhatsAppPurchaseContext({
      productName: 'Camisa lino',
      size: 'M',
      color: 'Azul',
      quantity: 2,
      unitPriceCents: 1250,
      stock: 4,
      available: true,
    })
    expect(response.message).toContain('Camisa lino')
    expect(response.message).toContain('Talla: M; color: Azul')
    expect(response.message).toContain('Cantidad solicitada: 2')
    expect(response.message).toContain('Precio actual: $12,50 USD por unidad')
    expect(response.message).toContain('Stock actual: 4 unidades')
    expect(response.message).toContain('termina el checkout')
    expect(response.message).toContain('no creó un pedido')
  })

  it('no presenta disponibilidad si el stock actual ya no alcanza', () => {
    const response = routeWhatsAppPurchaseContext({
      productName: 'Camisa lino',
      size: 'M',
      color: 'Azul',
      quantity: 2,
      unitPriceCents: 1250,
      stock: 1,
      available: false,
    })
    expect(response.message).toContain('Stock actual: 1 unidades')
    expect(response.message).toContain('La disponibilidad cambió')
    expect(response.message).toContain('ni se reservó inventario')
  })

  it('devuelve un enlace de la misma variante para continuar en el sitio', () => {
    const response = routeWhatsAppPurchaseContext({
      productSlug: 'camisa-lino',
      productUrl: 'https://nortemoda.example/producto/camisa-lino?talla=M&color=Azul&cantidad=2',
      productName: 'Camisa lino',
      size: 'M',
      color: 'Azul',
      quantity: 2,
      unitPriceCents: 1250,
      stock: 4,
      available: true,
    })

    expect(response.message).toContain('https://nortemoda.example/producto/camisa-lino')
    expect(response.message).toContain('misma talla, color y cantidad')
  })

  it('no revela el producto para una referencia vencida o ligada a otro teléfono', () => {
    const response = routeWhatsAppPurchaseContext(null)
    expect(response.message).toContain('No pude validar esa referencia')
    expect(response.message).not.toContain('Camisa lino')
  })
})
