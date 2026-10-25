import { requireAdmin } from '../_shared/admin.ts'
import { corsHeaders, isAllowedOrigin, json } from '../_shared/http.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, 405, { error: 'Method not allowed.' })
  if (!isAllowedOrigin(request)) return json(request, 403, { error: 'Origin not allowed.' })

  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return json(request, 401, { error: 'Se requiere una cuenta de administración autorizada.' })
    }
    const body: unknown = await request.json()
    if (!isRecord(body) || typeof body['orderId'] !== 'string' || !UUID.test(body['orderId'])) {
      return json(request, 400, { error: 'Identificador de pedido inválido.' })
    }

    const { data: attempt, error } = await admin.service
      .from('payment_attempts')
      .select('receipt_path')
      .eq('order_id', body['orderId'])
      .not('receipt_path', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('admin-payment-receipt lookup failed', { code: error.code })
      return json(request, 503, { error: 'No se pudo consultar el comprobante.' })
    }
    if (!attempt || typeof attempt.receipt_path !== 'string') {
      return json(request, 404, { error: 'Este pedido no tiene un comprobante disponible.' })
    }

    const { data: signed, error: signingError } = await admin.service.storage
      .from('payment-receipts')
      .createSignedUrl(attempt.receipt_path, 60, { download: true })
    if (signingError || !signed?.signedUrl) {
      console.error('admin-payment-receipt signing failed', {
        code: signingError?.name ?? 'empty_url',
      })
      return json(request, 503, { error: 'No se pudo generar el acceso temporal al comprobante.' })
    }
    return json(request, 200, { url: signed.signedUrl, expiresIn: 60 })
  } catch {
    return json(request, 503, { error: 'El panel remoto no está configurado.' })
  }
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
