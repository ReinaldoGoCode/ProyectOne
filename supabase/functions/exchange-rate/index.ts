import { corsHeaders, getServiceClient, isAllowedOrigin, json } from '../_shared/http.ts'
import {
  BcvRateError,
  BCV_CACHE_MAX_AGE_HOURS,
  BCV_SOURCE_URL,
  isEffectiveBcvRateStale,
  parseBcvRateApi,
} from '../../../src/domain/exchangeRate.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'GET')
    return publicRateResponse(request, 405, { error: 'Method not allowed.' })
  // Scheduled pg_net calls have no browser Origin header. Keep the configured
  // exact-origin check for browsers while allowing server-to-server refreshes.
  if (request.headers.has('origin') && !isAllowedOrigin(request))
    return publicRateResponse(request, 403, { error: 'Origin not allowed.' })

  try {
    const client = getServiceClient()
    const { data: claimed, error: claimError } = await client.rpc('claim_bcv_rate_refresh')
    if (claimError) {
      console.error('exchange-rate refresh claim failed', { code: claimError.code })
    } else if (claimed === true) {
      await refreshRate(client)
    }

    const { data: cached, error: cacheError } = await client
      .from('bcv_rate_cache')
      .select('ves_per_usd,effective_date,retrieved_at,source_url,last_error_code')
      .eq('id', true)
      .maybeSingle()

    if (cacheError) {
      console.error('exchange-rate cache read failed', { code: cacheError.code })
      return publicRateResponse(request, 503, {
        rate: null,
        warning: 'No se pudo leer la tasa guardada. Los precios se muestran solo en USD.',
      })
    }
    const cachedRate = normalizeCachedRate(cached?.ves_per_usd)
    if (
      !cached ||
      cachedRate === null ||
      typeof cached.effective_date !== 'string' ||
      typeof cached.retrieved_at !== 'string' ||
      cached.source_url !== BCV_SOURCE_URL
    ) {
      return publicRateResponse(request, 200, {
        rate: null,
        warning:
          'No hay una tasa BCV validada guardada. La tienda mostrará precios solo en USD hasta obtener una.',
      })
    }

    const now = new Date()
    const retrievedAtMs = Date.parse(cached.retrieved_at)
    const stale =
      isEffectiveBcvRateStale(cached.effective_date, now) ||
      !Number.isFinite(retrievedAtMs) ||
      now.getTime() - retrievedAtMs > BCV_CACHE_MAX_AGE_HOURS * 60 * 60 * 1000 ||
      cached.last_error_code !== null
    const warning = stale
      ? 'No se pudo confirmar una actualización reciente; se muestra la última tasa validada con su fecha.'
      : null

    return publicRateResponse(request, 200, {
      rate: {
        vesPerUsd: cachedRate,
        effectiveDate: cached.effective_date,
        sourceUrl: cached.source_url,
        retrievedAt: cached.retrieved_at,
        isStale: stale,
        warning,
      },
      warning,
    })
  } catch {
    return publicRateResponse(request, 503, {
      rate: null,
      warning: 'No se pudo consultar la tasa guardada. Los precios se muestran solo en USD.',
    })
  }
})

async function refreshRate(client: ReturnType<typeof getServiceClient>): Promise<void> {
  try {
    const response = await fetch(BCV_SOURCE_URL, {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'User-Agent': 'NorteModa/1.0 (+BCV rate cache)',
      },
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    })
    if (
      !response.ok ||
      !response.headers.get('content-type')?.toLowerCase().includes('application/json') ||
      new URL(response.url).hostname !== 'rates.dolarvzla.com'
    ) {
      console.error('exchange-rate BCV response rejected', {
        status: response.status,
        contentType: response.headers.get('content-type'),
        hostname: new URL(response.url).hostname,
      })
      await recordFailure(client, 'upstream_unavailable')
      return
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      await recordFailure(client, 'invalid_upstream_data')
      return
    }

    let rate: ReturnType<typeof parseBcvRateApi>
    try {
      rate = parseBcvRateApi(payload)
    } catch (error) {
      const code = error instanceof BcvRateError ? error.code : 'invalid_upstream_data'
      await recordFailure(client, code)
      return
    }

    const { error } = await client.rpc('save_bcv_rate', {
      p_ves_per_usd: rate.vesPerUsd,
      p_effective_date: rate.effectiveDate,
    })
    if (error) {
      console.error('exchange-rate cache write failed', { code: error.code })
      await recordFailure(client, error.code === '22023' ? 'stale_source' : 'database_write_failed')
      return
    }
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined
    console.error('exchange-rate BCV request failed', {
      name: error instanceof Error ? error.name : 'unknown',
      message: error instanceof Error ? error.message.slice(0, 240) : 'unknown',
      causeName: cause instanceof Error ? cause.name : 'unknown',
      causeMessage: cause instanceof Error ? cause.message.slice(0, 240) : 'unknown',
    })
    await recordFailure(client, 'upstream_unavailable')
  }
}

async function recordFailure(
  client: ReturnType<typeof getServiceClient>,
  code: 'upstream_unavailable' | 'invalid_upstream_data' | 'stale_source' | 'database_write_failed',
): Promise<void> {
  const { error } = await client.rpc('record_bcv_rate_failure', { p_error_code: code })
  if (error) console.error('exchange-rate failure state could not be stored', { code: error.code })
}

function publicRateResponse(request: Request, status: number, body: unknown): Response {
  const response = json(request, status, body)
  response.headers.set(
    'Cache-Control',
    status >= 200 && status < 300
      ? 'public, max-age=300, s-maxage=300, stale-while-revalidate=600'
      : 'no-store',
  )
  return response
}

function normalizeCachedRate(value: unknown): string | null {
  if (typeof value === 'string' && /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) {
    return value
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 10_000_000) {
    return null
  }
  return value
    .toFixed(6)
    .replace(/(?:\.0+|(?<=\d)0+)$/, '')
    .replace(/\.$/, '')
}
