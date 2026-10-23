import { requireAdmin } from '../_shared/admin.ts'
import { corsHeaders, isAllowedOrigin, json } from '../_shared/http.ts'

const MANUAL_METHODS = ['pago_movil', 'transferencia', 'efectivo_ves', 'efectivo_usd']

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (!['GET', 'POST'].includes(request.method)) {
    return json(request, 405, { error: 'Method not allowed.' })
  }
  if (!isAllowedOrigin(request)) return json(request, 403, { error: 'Origin not allowed.' })
  try {
    const admin = await requireAdmin(request)
    if (!admin) return json(request, 401, { error: 'Se requiere una cuenta autorizada.' })
    if (request.method === 'GET') {
      const { data, error } = await admin.service
        .from('payment_methods')
        .select('method, label, kind, active, public_instructions, provider_ready')
        .order('kind')
        .order('method')
      if (error) {
        console.error('admin-payment-settings read failed', { code: error.code })
        return json(request, 503, { error: 'No se pudieron consultar los métodos.' })
      }
      return json(request, 200, { methods: data ?? [] })
    }

    const body: unknown = await request.json()
    if (!isRecord(body) || !Array.isArray(body.methods) || body.methods.length !== 4) {
      return json(request, 400, { error: 'La configuración de pagos no es válida.' })
    }
    if (!body.methods.every(isManualMethod)) {
      return json(request, 400, { error: 'Solo se pueden configurar métodos manuales.' })
    }
    const { data, error } = await admin.service.rpc('admin_update_payment_methods', {
      p_actor_user_id: admin.userId,
      p_methods: body.methods,
    })
    if (error || !data) {
      if (error?.code === '22023') {
        return json(request, 400, {
          error: 'Activa métodos solo con instrucciones públicas completas.',
        })
      }
      console.error('admin-payment-settings update failed', { code: error?.code ?? 'empty_result' })
      return json(request, 503, { error: 'No se pudo guardar la configuración de pagos.' })
    }
    return json(request, 200, { methods: data })
  } catch {
    return json(request, 400, { error: 'No se pudo procesar la configuración de pagos.' })
  }
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isManualMethod(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.method === 'string' &&
    MANUAL_METHODS.includes(value.method) &&
    typeof value.active === 'boolean' &&
    typeof value.instructions === 'string'
  )
}
