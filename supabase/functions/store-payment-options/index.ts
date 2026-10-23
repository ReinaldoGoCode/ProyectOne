import { corsHeaders, isAllowedOrigin, json } from '../_shared/http.ts'
import { getServiceClient } from '../_shared/http.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'GET') return json(request, 405, { error: 'Method not allowed.' })
  if (!isAllowedOrigin(request)) return json(request, 403, { error: 'Origin not allowed.' })
  try {
    const { data, error } = await getServiceClient()
      .from('payment_methods')
      .select('method, label, kind, active, public_instructions, provider_ready')
      .eq('active', true)
      .eq('kind', 'manual')
      .order('method')
    if (error) {
      console.error('store-payment-options failed', { code: error.code })
      return json(request, 503, { error: 'No se pudieron consultar los métodos de pago.' })
    }
    return json(request, 200, {
      methods: (data ?? []).map((item) => ({
        method: item.method,
        label: item.label,
        instructions: item.public_instructions,
      })),
    })
  } catch {
    return json(request, 503, { error: 'Los métodos de pago remotos no están configurados.' })
  }
})
