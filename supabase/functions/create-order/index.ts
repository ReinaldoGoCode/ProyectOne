import { corsHeaders, getServiceClient, isAllowedOrigin, json, sha256Hex } from '../_shared/http.ts'
import { isRemoteManualPaymentMethod } from '../../../src/domain/paymentMethods.ts'
import { hashWhatsAppPhone } from '../../../src/lib/whatsappWebhook.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, 405, { error: 'Method not allowed.' })
  if (!isAllowedOrigin(request)) return json(request, 403, { error: 'Origin not allowed.' })
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return json(request, 415, { error: 'Se requiere contenido JSON.' })
  }

  try {
    const body = await request.json()
    if (!isRecord(body)) return json(request, 400, { error: 'Solicitud inválida.' })
    const idempotencyKey = stringValue(body.idempotencyKey)
    const trackingToken = stringValue(body.trackingToken)
    const quoteId = stringValue(body.quoteId)
    const expectedSubtotalCents = safeCents(body.expectedSubtotalCents)
    const expectedShippingCents = safeCents(body.expectedShippingCents)
    const expectedTotalCents = safeCents(body.expectedTotalCents)
    const expectedVesTotalCents = safeCents(body.expectedVesTotalCents)
    const items = Array.isArray(body.items) ? body.items : []
    if (
      !UUID.test(idempotencyKey) ||
      !UUID.test(quoteId) ||
      !/^[0-9a-f]{64}$/i.test(trackingToken) ||
      expectedSubtotalCents === null ||
      expectedShippingCents === null ||
      expectedTotalCents === null ||
      expectedVesTotalCents === null
    ) {
      return json(request, 400, { error: 'Faltan identificadores seguros de la solicitud.' })
    }
    if (items.length < 1 || items.length > 25 || !items.every(isValidLine)) {
      return json(request, 400, { error: 'El carrito contiene variantes o cantidades inválidas.' })
    }

    const customer = isRecord(body.customer)
      ? {
          firstName: bounded(body.customer.firstName, 2, 80),
          lastName: bounded(body.customer.lastName, 2, 80),
          phone: bounded(body.customer.phone, 8, 30),
          email:
            typeof body.customer.email === 'string' && body.customer.email.trim() !== ''
              ? bounded(body.customer.email, 3, 200)
              : null,
        }
      : null
    if (!customer || !/^\+?[0-9\s()\-]{8,30}$/.test(customer.phone)) {
      return json(request, 400, { error: 'Los datos de contacto no son válidos.' })
    }
    const deliveryMethod = stringValue(body.deliveryMethod)
    const paymentMethod = stringValue(body.paymentMethod)
    const address = body.shippingAddress === null ? null : sanitizeAddress(body.shippingAddress)
    const agency = body.shippingAgency === null ? null : bounded(body.shippingAgency, 2, 80)
    const customerNote = body.customerNote === null ? null : bounded(body.customerNote, 0, 300)
    if (body.whatsappOptIn !== undefined && typeof body.whatsappOptIn !== 'boolean') {
      return json(request, 400, { error: 'El permiso de contacto por WhatsApp no es válido.' })
    }
    const whatsappOptIn = body.whatsappOptIn === true
    if (whatsappOptIn && !/^[1-9][0-9]{7,14}$/.test(customer.phone.replace(/\D/g, ''))) {
      return json(request, 400, {
        error: 'Para el seguimiento por WhatsApp, escribe el teléfono con su código internacional.',
      })
    }
    if (
      !['delivery_local', 'envio_nacional', 'retiro'].includes(deliveryMethod) ||
      !isRemoteManualPaymentMethod(paymentMethod)
    ) {
      return json(request, 400, { error: 'La forma de entrega o pago no es válida.' })
    }
    if (deliveryMethod !== 'retiro' && (!address || address.city.length < 2)) {
      return json(request, 400, { error: 'Indica la ciudad y dirección de entrega.' })
    }
    if (deliveryMethod === 'delivery_local' && (!address || address.addressLine.length < 5)) {
      return json(request, 400, { error: 'Indica una dirección de delivery válida.' })
    }
    if (deliveryMethod === 'envio_nacional' && (!address || address.state.length < 2 || !agency)) {
      return json(request, 400, { error: 'Indica estado y agencia para el envío.' })
    }

    const client = getServiceClient()
    const phoneHashSecret = Deno.env.get('WHATSAPP_PHONE_HASH_SECRET') ?? ''
    if (whatsappOptIn && phoneHashSecret.length < 32) {
      return json(request, 503, {
        error:
          'El seguimiento de WhatsApp no está configurado. Desmarca el permiso para continuar.',
      })
    }
    const senderHash = whatsappOptIn
      ? await hashWhatsAppPhone(customer.phone, phoneHashSecret)
      : null
    const { data, error } = await client.rpc('create_public_order_whatsapp_v3', {
      p_idempotency_key: idempotencyKey,
      p_tracking_token_hash: await sha256Hex(trackingToken.toLowerCase()),
      p_customer: customer,
      p_delivery_method: deliveryMethod,
      p_shipping_address: address,
      p_shipping_agency: agency,
      p_payment_method: paymentMethod,
      p_customer_note: customerNote,
      p_items: items.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
      p_quote_id: quoteId,
      p_expected_subtotal_cents: expectedSubtotalCents,
      p_expected_shipping_cents: expectedShippingCents,
      p_expected_total_cents: expectedTotalCents,
      p_expected_ves_total_cents: expectedVesTotalCents,
      p_whatsapp_opt_in: whatsappOptIn,
      p_sender_hash: senderHash,
    })
    if (error || !data) {
      if (error?.code === 'P0002')
        return json(request, 409, { error: 'Una variante ya no está disponible en esa cantidad.' })
      if (error?.code === '22023')
        return json(request, 400, { error: 'La solicitud venció o tiene datos no válidos.' })
      if (error?.code === 'P0001')
        return json(request, 409, {
          error: 'La cotización cambió; revisa y confirma el importe actualizado.',
        })
      console.error('create-order failed', { code: error?.code ?? 'empty_result' })
      return json(request, 503, { error: 'No se pudo guardar el pedido.' })
    }
    return json(request, 201, { order: data, trackingToken: trackingToken.toLowerCase() })
  } catch {
    return json(request, 400, { error: 'No se pudo procesar la solicitud.' })
  }
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function safeCents(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : null
}

function bounded(value: unknown, min: number, max: number): string {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max
    ? value.trim()
    : ''
}

function isValidLine(value: unknown): value is { variantId: string; quantity: number } {
  return (
    isRecord(value) &&
    typeof value.variantId === 'string' &&
    value.variantId.length > 0 &&
    value.variantId.length <= 120 &&
    Number.isInteger(value.quantity) &&
    (value.quantity as number) >= 1 &&
    (value.quantity as number) <= 10
  )
}

function sanitizeAddress(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null
  const result = {
    state: bounded(value.state, 0, 80),
    city: bounded(value.city, 2, 80),
    addressLine: bounded(value.addressLine, 0, 200),
    reference: bounded(value.reference, 0, 200),
  }
  return result
}
