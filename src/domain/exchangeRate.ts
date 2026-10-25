export const BCV_SOURCE_URL = 'https://rates.dolarvzla.com/bcv/current.json'
export const BCV_OFFICIAL_SOURCE_URL = 'https://www.bcv.org.ve/'
export const BCV_RATE_EFFECTIVE_MAX_AGE_DAYS = 3
export const BCV_RATE_EFFECTIVE_MAX_FUTURE_DAYS = 4
export const BCV_CACHE_MAX_AGE_HOURS = 96

export interface ValidatedBcvRate {
  readonly vesPerUsd: string
  readonly effectiveDate: string
  readonly sourceUrl: typeof BCV_SOURCE_URL
}

export interface PublicBcvRate extends ValidatedBcvRate {
  readonly retrievedAt: string
  readonly isStale: boolean
  readonly warning: string | null
}

export type BcvRateValidationError = 'invalid_upstream_data' | 'stale_source'

export class BcvRateError extends Error {
  readonly code: BcvRateValidationError

  constructor(code: BcvRateValidationError) {
    super(
      code === 'stale_source'
        ? 'La API de la tasa BCV publicó una fecha fuera del rango esperado.'
        : 'La API de la tasa BCV no contiene un valor reconocible.',
    )
    this.code = code
    this.name = 'BcvRateError'
  }
}

/** Parse and validate the documented BCV JSON feed from DolarVZLA. */
export function parseBcvRateApi(payload: unknown, now = new Date()): ValidatedBcvRate {
  if (!isRecord(payload) || !isRecord(payload['current'])) {
    throw new BcvRateError('invalid_upstream_data')
  }

  const effectiveDate = payload['current']['date']
  const rawRate = payload['current']['usd']
  if (
    typeof effectiveDate !== 'string' ||
    !isIsoDate(effectiveDate) ||
    !(typeof rawRate === 'string' || typeof rawRate === 'number')
  ) {
    throw new BcvRateError('invalid_upstream_data')
  }

  const vesPerUsd = normalizeRate(rawRate)
  if (vesPerUsd === null) throw new BcvRateError('invalid_upstream_data')
  if (isEffectiveBcvRateStale(effectiveDate, now)) throw new BcvRateError('stale_source')

  return { vesPerUsd, effectiveDate, sourceUrl: BCV_SOURCE_URL }
}

export function isEffectiveBcvRateStale(effectiveDate: string, now = new Date()): boolean {
  if (!isIsoDate(effectiveDate)) return true
  const deltaDays = dateDifferenceDays(getCaracasDate(now), effectiveDate)
  return (
    deltaDays > BCV_RATE_EFFECTIVE_MAX_AGE_DAYS || deltaDays < -BCV_RATE_EFFECTIVE_MAX_FUTURE_DAYS
  )
}

function normalizeRate(value: string | number): string | null {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : String(value)
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(text)) return null

  const [integerText = '', fractionText = ''] = text.split('.')
  if (integerText.length > 8) return null

  const scale = 1_000_000n
  let micros = BigInt(integerText) * scale + BigInt(fractionText.slice(0, 6).padEnd(6, '0'))
  if ((fractionText[6] ?? '0') >= '5') micros += 1n
  if (micros <= 0n || micros > 10_000_000n * scale) return null

  const whole = micros / scale
  const fraction = String(micros % scale)
    .padStart(6, '0')
    .replace(/0+$/, '')
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString()
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function getCaracasDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values['year'] ?? ''}-${values['month'] ?? ''}-${values['day'] ?? ''}`
}

function dateDifferenceDays(later: string, earlier: string): number {
  const laterMs = Date.parse(`${later}T00:00:00.000Z`)
  const earlierMs = Date.parse(`${earlier}T00:00:00.000Z`)
  return Math.floor((laterMs - earlierMs) / 86_400_000)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
