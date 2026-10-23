import { corsHeaders, getServiceClient, isAllowedOrigin, json, sha256Hex } from '../_shared/http.ts'

const ORDER_CODE = /^NM-[0-9]{3,12}$/
const TRACKING_TOKEN = /^[0-9a-f]{64}$/i
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._ -]{3,79}$/

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

    const code = stringValue(body.code).toUpperCase()
    const trackingToken = stringValue(body.trackingToken)
    const reference = stringValue(body.reference)
    const note = stringValue(body.note).slice(0, 300)

    if (
      !ORDER_CODE.test(code) ||
      !TRACKING_TOKEN.test(trackingToken) ||
      !REFERENCE.test(reference)
    ) {
      return json(request, 400, { error: 'El código, el enlace o la referencia no son válidos.' })
    }

    const client = getServiceClient()
    const { data, error } = await client.rpc('submit_public_payment_reference', {
      p_code: code,
      p_tracking_token_hash: await sha256Hex(trackingToken.toLowerCase()),
      p_reference: reference,
      p_note: note,
    })

    if (error || !data) {
      if (error?.code === 'P0002') {
        return json(request, 404, {
          error: 'No encontramos el pedido con ese enlace privado.',
        })
      }
      if (error?.code === '22023') {
        return json(request, 409, {
          error: 'El pedido no acepta una referencia en este momento.',
        })
      }
      console.error('submit-payment-reference failed', { code: error?.code ?? 'empty_result' })
      return json(request, 503, { error: 'No se pudo registrar la referencia de pago.' })
    }

    return json(request, 200, { result: data })
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
