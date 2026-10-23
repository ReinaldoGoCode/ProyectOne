import { requireAdmin } from '../_shared/admin.ts'
import { corsHeaders, isAllowedOrigin, json } from '../_shared/http.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_PERIOD_DAYS = 366

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, 405, { error: 'Method not allowed.' })
  if (!isAllowedOrigin(request)) return json(request, 403, { error: 'Origin not allowed.' })

  try {
    const admin = await requireAdmin(request)
    if (!admin)
      return json(request, 401, { error: 'Se requiere una cuenta de administración autorizada.' })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return json(request, 400, { error: 'El período seleccionado no es válido.' })
    }
    if (!isRecord(body) || typeof body.from !== 'string' || typeof body.to !== 'string') {
      return json(request, 400, { error: 'Selecciona las fechas de inicio y fin.' })
    }

    const range = parseDateRange(body.from, body.to)
    if (!range) {
      return json(request, 400, {
        error: `Selecciona fechas válidas dentro de un período máximo de ${MAX_PERIOD_DAYS} días.`,
      })
    }

    const { data, error } = await admin.service.rpc('admin_dashboard_summary', {
      p_actor_user_id: admin.userId,
      p_from: range.from.toISOString(),
      p_to_exclusive: range.toExclusive.toISOString(),
    })
    if (error || !isRecord(data)) {
      console.error('admin-dashboard failed', { code: error?.code })
      return json(request, 503, { error: 'No se pudo calcular el resumen administrativo.' })
    }
    return json(request, 200, {
      summary: { ...data, period: { from: body.from, to: body.to } },
    })
  } catch {
    return json(request, 503, { error: 'El panel remoto no está configurado.' })
  }
})

function parseDateRange(from: string, to: string) {
  if (!isCalendarDate(from) || !isCalendarDate(to)) return null
  const fromDate = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T00:00:00.000Z`)
  const toExclusive = new Date(toDate.getTime() + DAY_MS)
  const periodDays = (toExclusive.getTime() - fromDate.getTime()) / DAY_MS
  if (fromDate >= toExclusive || periodDays > MAX_PERIOD_DAYS) return null
  return { from: fromDate, toExclusive }
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
