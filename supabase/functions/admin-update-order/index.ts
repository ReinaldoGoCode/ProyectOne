import { requireAdmin } from '../_shared/admin.ts'
import { corsHeaders, isAllowedOrigin, json } from '../_shared/http.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, 405, { error: 'Method not allowed.' })
  if (!isAllowedOrigin(request)) return json(request, 403, { error: 'Origin not allowed.' })

  try {
    const admin = await requireAdmin(request)
    if (!admin)
      return json(request, 401, { error: 'Se requiere una cuenta de administración autorizada.' })
    const body = await request.json()
    if (!isRecord(body) || typeof body.orderId !== 'string' || !UUID.test(body.orderId)) {
      return json(request, 400, { error: 'Identificador de pedido inválido.' })
    }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : ''
    let result
    let error
    if (
      body.action === 'payment' &&
      ['review', 'paid', 'rejected', 'cancelled', 'pending'].includes(String(body.status))
    ) {
      ;({ data: result, error } = await admin.service.rpc('admin_update_payment', {
        p_order_id: body.orderId,
        p_next_status: body.status,
        p_note: note,
        p_actor_user_id: admin.userId,
      }))
    } else if (
      body.action === 'fulfillment' &&
      ['preparing', 'shipped', 'delivered', 'cancelled'].includes(String(body.status))
    ) {
      ;({ data: result, error } = await admin.service.rpc('admin_update_fulfillment', {
        p_order_id: body.orderId,
        p_next_status: body.status,
        p_note: note,
        p_actor_user_id: admin.userId,
      }))
    } else if (body.action === 'resolve_inventory') {
      ;({ data: result, error } = await admin.service.rpc('admin_resolve_inventory_exception', {
        p_order_id: body.orderId,
        p_actor_user_id: admin.userId,
      }))
    } else {
      return json(request, 400, { error: 'Cambio de estado no válido.' })
    }
    if (error || !result) {
      if (error?.code === '42501')
        return json(request, 403, { error: 'No tienes permisos para este cambio.' })
      if (error?.code === '22023' || error?.code === 'P0002')
        return json(request, 409, {
          error: 'El pedido cambió o la transición ya no está permitida.',
        })
      console.error('admin-update-order failed', { code: error?.code ?? 'empty_result' })
      return json(request, 503, { error: 'No se pudo actualizar el pedido.' })
    }
    return json(request, 200, { result })
  } catch {
    return json(request, 400, { error: 'No se pudo procesar el cambio.' })
  }
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
