import { requireAdmin } from '../_shared/admin.ts'
import { corsHeaders, isAllowedOrigin, json } from '../_shared/http.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json(request, 405, { error: 'Method not allowed.' })
  }
  if (!isAllowedOrigin(request)) return json(request, 403, { error: 'Origin not allowed.' })
  const admin = await requireAdmin(request)
  if (!admin) return json(request, 401, { error: 'Administrator access required.' })

  if (request.method === 'GET') {
    const { data, error } = await admin.service
      .from('whatsapp_handoffs')
      .select('id,sender_phone,order_code,reason,status,created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) {
      console.error('admin-whatsapp-handoffs query failed', { code: error.code })
      return json(request, 503, { error: 'No se pudieron cargar las solicitudes de WhatsApp.' })
    }
    return json(request, 200, { handoffs: data ?? [] })
  }

  try {
    const body: unknown = await request.json()
    if (!isRecord(body) || typeof body['id'] !== 'string' || !UUID.test(body['id'])) {
      return json(request, 400, { error: 'Solicitud de atención inválida.' })
    }
    const status = body['status']
    if (status !== 'claimed' && status !== 'resolved') {
      return json(request, 400, { error: 'Estado de atención inválido.' })
    }
    const { data, error } = await admin.service.rpc('admin_update_whatsapp_handoff', {
      p_handoff_id: body['id'],
      p_next_status: status,
      p_actor_user_id: admin.userId,
    })
    if (error || !data) {
      console.error('admin-whatsapp-handoffs update failed', {
        code: error?.code ?? 'empty_result',
      })
      return json(request, 409, { error: 'No se pudo cambiar el estado de la atención.' })
    }
    return json(request, 200, { handoff: data })
  } catch {
    return json(request, 400, { error: 'Solicitud inválida.' })
  }
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
