import { corsHeaders, getServiceClient, isAllowedOrigin, json, sha256Hex } from '../_shared/http.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, 405, { error: 'Method not allowed.' })
  if (!isAllowedOrigin(request)) return json(request, 403, { error: 'Origin not allowed.' })

  try {
    const body = await request.json()
    if (!isRecord(body)) return json(request, 400, { error: 'Solicitud inválida.' })
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    const token =
      typeof body.trackingToken === 'string' ? body.trackingToken.trim().toLowerCase() : ''
    if (!/^NM-[0-9]{4,12}$/.test(code) || !/^[0-9a-f]{64}$/.test(token)) {
      return json(request, 404, { error: 'No se encontró el pedido o el acceso no es válido.' })
    }

    const client = getServiceClient()
    const { data, error } = await client.rpc('lookup_public_order', {
      p_code: code,
      p_tracking_token_hash: await sha256Hex(token),
    })
    if (error) {
      console.error('lookup-order failed', { code: error.code })
      return json(request, 503, { error: 'No se pudo consultar el pedido.' })
    }
    if (!data)
      return json(request, 404, { error: 'No se encontró el pedido o el acceso no es válido.' })
    return json(request, 200, { order: data })
  } catch {
    return json(request, 400, { error: 'No se pudo procesar la consulta.' })
  }
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
