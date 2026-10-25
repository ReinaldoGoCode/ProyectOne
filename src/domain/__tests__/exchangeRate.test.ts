import { describe, expect, it } from 'vitest'

import { BcvRateError, parseBcvRateApi } from '../exchangeRate'

const now = new Date('2026-10-25T04:20:00.000Z')

function apiPayload(usd: string | number = 887.302, date = '2026-10-27') {
  return { current: { date, usd }, previous: { date: '2026-10-23', usd: 886.2271 } }
}

describe('API de tasas BCV', () => {
  it('lee la tasa y fecha efectiva del feed verificado', () => {
    expect(parseBcvRateApi(apiPayload(), now)).toEqual({
      vesPerUsd: '887.302',
      effectiveDate: '2026-10-27',
      sourceUrl: 'https://rates.dolarvzla.com/bcv/current.json',
    })
  })

  it('redondea a seis decimales con aritmética decimal', () => {
    expect(parseBcvRateApi(apiPayload('1234.5678915'), now).vesPerUsd).toBe('1234.567892')
  })

  it('rechaza fechas demasiado antiguas o futuras', () => {
    expect(() => parseBcvRateApi(apiPayload(887.3, '2026-10-20'), now)).toThrow(BcvRateError)
    expect(() => parseBcvRateApi(apiPayload(887.3, '2026-10-30'), now)).toThrow(BcvRateError)
  })

  it('rechaza valores ambiguos, inválidos, no positivos o fuera de rango', () => {
    for (const rate of ['0', '-1', '1,2', '887.30.2', '100000000', Infinity]) {
      expect(() => parseBcvRateApi(apiPayload(rate), now), String(rate)).toThrow(BcvRateError)
    }
  })

  it('rechaza una respuesta que no contiene el bloque current esperado', () => {
    expect(() => parseBcvRateApi({ tasa: 887.3 }, now)).toThrow(BcvRateError)
    expect(() => parseBcvRateApi(apiPayload(887.3, '27-10-2026'), now)).toThrow(BcvRateError)
  })
})
