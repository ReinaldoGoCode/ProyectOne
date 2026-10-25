import { corsHeaders, getServiceClient, isAllowedOrigin, json } from '../_shared/http.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, 405, { error: 'Method not allowed.' })
  if (!isAllowedOrigin(request)) return json(request, 403, { error: 'Origin not allowed.' })
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return json(request, 415, { error: 'Se requiere contenido JSON.' })
  }

  try {
    const body: unknown = await request.json()
    if (!isRecord(body)) return json(request, 400, { error: 'Solicitud inválida.' })
    const deliveryMethod = stringValue(body['deliveryMethod'])
    const items = Array.isArray(body['items']) ? body['items'] : []
    if (!['delivery_local', 'envio_nacional', 'retiro'].includes(deliveryMethod)) {
      return json(request, 400, { error: 'La forma de entrega no es válida.' })
    }
    if (items.length < 1 || items.length > 25 || !items.every(isValidLine)) {
      return json(request, 400, { error: 'El carrito contiene variantes o cantidades inválidas.' })
    }

    const client = getServiceClient()
    const { data: quote, error: quoteError } = await client.rpc('issue_bcv_quote')
    if (
      quoteError ||
      !isRecord(quote) ||
      typeof quote['id'] !== 'string' ||
      !UUID.test(quote['id'])
    ) {
      console.error('checkout-quote rate failed', { code: quoteError?.code ?? 'invalid_quote' })
      return json(request, 503, {
        error:
          quoteError?.code === 'P0003'
            ? 'No hay una tasa BCV validada y vigente para cotizar en bolívares. El pedido no se creó.'
            : 'No se pudo consultar la tasa BCV. El pedido no se creó.',
      })
    }
    const { data, error } = await client.rpc('preview_public_order', {
      p_items: items.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
      p_delivery_method: deliveryMethod,
      p_quote_id: quote['id'],
    })
    if (error || !isRecord(data)) {
      if (error?.code === 'P0002') {
        return json(request, 409, { error: 'Una variante ya no está disponible en esa cantidad.' })
      }
      if (error?.code === '22023') return json(request, 400, { error: 'El carrito no es válido.' })
      console.error('checkout-quote preview failed', { code: error?.code ?? 'empty_result' })
      return json(request, 503, { error: 'No se pudo calcular el importe del pedido.' })
    }
    return json(request, 200, { quote: { ...quote, ...data } })
  } catch {
    return json(request, 503, { error: 'El servicio de cotización no está configurado.' })
  }
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidLine(value: unknown): value is { variantId: string; quantity: number } {
  return (
    isRecord(value) &&
    typeof value['variantId'] === 'string' &&
    value['variantId'].length > 0 &&
    value['variantId'].length <= 120 &&
    Number.isInteger(value['quantity']) &&
    (value['quantity'] as number) >= 1 &&
    (value['quantity'] as number) <= 10
  )
}
