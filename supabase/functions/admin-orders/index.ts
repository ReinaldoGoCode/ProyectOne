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
          .select(
            'order_id, reference, created_at, reported_amount_cents, reported_currency, paid_at, note, amount_matches, receipt_path',
          )
          .in('order_id', orderIds)
          .not('reference', 'is', null)
          .order('created_at', { ascending: false })
      : { data: [], error: null }
    if (attemptsResult.error) {
      console.error('admin-orders payment references failed', { code: attemptsResult.error.code })
      return json(request, 503, { error: 'No se pudieron consultar las referencias de pago.' })
    }
    const paymentReports = attemptsResult.data ?? []
    const reports = new Map<string, (typeof paymentReports)[number]>()
    for (const attempt of paymentReports) {
      if (!reports.has(attempt.order_id) && typeof attempt.reference === 'string') {
        reports.set(attempt.order_id, attempt)
      }
    }
    return json(request, 200, {
      orders: orderRows.map((order) => ({
        ...order,
        payment_reference: reports.get(order.id)?.reference ?? null,
        payment_reported_amount_cents: reports.get(order.id)?.reported_amount_cents ?? null,
        payment_reported_currency: reports.get(order.id)?.reported_currency ?? null,
        payment_paid_at: reports.get(order.id)?.paid_at ?? null,
        payment_note: reports.get(order.id)?.note ?? null,
        payment_amount_matches: reports.get(order.id)?.amount_matches ?? null,
        payment_receipt_available: typeof reports.get(order.id)?.receipt_path === 'string',
      })),
    })
  } catch {
    return json(request, 503, { error: 'El panel remoto no está configurado.' })
  }
})
