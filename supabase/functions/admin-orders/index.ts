import { requireAdmin } from '../_shared/admin.ts'
import { corsHeaders, isAllowedOrigin, json } from '../_shared/http.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'GET') return json(request, 405, { error: 'Method not allowed.' })
  if (!isAllowedOrigin(request)) return json(request, 403, { error: 'Origin not allowed.' })

  try {
    const admin = await requireAdmin(request)
    if (!admin)
      return json(request, 401, { error: 'Se requiere una cuenta de administración autorizada.' })
    const { data, error } = await admin.service
      .from('orders')
      .select(
        'id, code, created_at, customer, total_cents, delivery_method, shipping_agency, shipping_company, shipping_tracking_number, shipping_notes, order_status, payment_status, fulfillment_status, order_items(id, product_name, size, color, quantity)',
      )
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) {
      console.error('admin-orders failed', { code: error.code })
      return json(request, 503, { error: 'No se pudieron consultar los pedidos.' })
    }
    const orderRows = data ?? []
    const orderIds = orderRows.map((order) => order.id)
    const attemptsResult = orderIds.length
      ? await admin.service
          .from('payment_attempts')
          .select('order_id, reference, created_at')
          .in('order_id', orderIds)
          .not('reference', 'is', null)
          .order('created_at', { ascending: false })
      : { data: [], error: null }
    if (attemptsResult.error) {
      console.error('admin-orders payment references failed', { code: attemptsResult.error.code })
      return json(request, 503, { error: 'No se pudieron consultar las referencias de pago.' })
    }
    const references = new Map<string, string>()
    for (const attempt of attemptsResult.data ?? []) {
      if (!references.has(attempt.order_id) && typeof attempt.reference === 'string') {
        references.set(attempt.order_id, attempt.reference)
      }
    }
    return json(request, 200, {
      orders: orderRows.map((order) => ({
        ...order,
        payment_reference: references.get(order.id) ?? null,
      })),
    })
  } catch {
    return json(request, 503, { error: 'El panel remoto no está configurado.' })
  }
})
