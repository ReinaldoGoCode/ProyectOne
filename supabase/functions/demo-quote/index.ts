import { corsHeaders, getServiceClient, isAllowedOrigin, json } from '../_shared/http.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, 405, { error: 'Method not allowed.' })
  if (!isAllowedOrigin(request)) return json(request, 403, { error: 'Origin not allowed.' })

  try {
    const client = getServiceClient()
    const { data, error } = await client.rpc('issue_bcv_quote')
    if (error || !data) {
      console.error('legacy demo-quote endpoint failed', { code: error?.code ?? 'empty_result' })
      return json(request, 503, {
        error: 'No hay una tasa BCV validada y vigente para cotizar en bolívares.',
      })
    }
    return json(request, 200, { quote: data })
  } catch {
    return json(request, 503, { error: 'El servicio de demostración no está configurado.' })
  }
})
