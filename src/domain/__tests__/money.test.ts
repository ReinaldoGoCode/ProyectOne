import { describe, expect, it } from 'vitest'

import { formatMoney, multiplyCents, sumCents, toCents } from '../money'

describe('formatMoney', () => {
  it('formatea centavos con dos decimales y símbolo de dólar', () => {
    expect(formatMoney(1999)).toBe('$19,99')
  })

  it('usa punto como separador de miles y coma como separador decimal', () => {
    expect(formatMoney(123_456_789)).toBe('$1.234.567,89')
  })

  it('formatea cero', () => {
    expect(formatMoney(0)).toBe('$0,00')
  })

  it('rechaza montos con decimales', () => {
    expect(() => formatMoney(19.99)).toThrow(RangeError)
  })

  it('rechaza montos negativos', () => {
    expect(() => formatMoney(-1)).toThrow(RangeError)
  })
})

describe('sumCents', () => {
  it('suma centavos sin errores de coma flotante', () => {
    expect(sumCents([1999, 1999, 1999])).toBe(5997)
  })

  it('devuelve 0 para una lista vacía', () => {
    expect(sumCents([])).toBe(0)
  })

  it('rechaza cualquier valor que no sea un entero no negativo', () => {
    expect(() => sumCents([100, -1])).toThrow(RangeError)
    expect(() => sumCents([100, 1.5])).toThrow(RangeError)
  })
})

describe('multiplyCents', () => {
  it('multiplica el precio unitario por la cantidad', () => {
    expect(multiplyCents(1999, 3)).toBe(5997)
  })

  it('acepta cantidad cero', () => {
    expect(multiplyCents(1999, 0)).toBe(0)
  })

  it('rechaza cantidades negativas, decimales o no numéricas', () => {
    expect(() => multiplyCents(1999, -1)).toThrow(RangeError)
    expect(() => multiplyCents(1999, 1.5)).toThrow(RangeError)
  })
})

describe('toCents', () => {
  it('convierte un importe con decimales sin arrastrar flotantes', () => {
    expect(toCents(19.99)).toBe(1999)
  })

  it('convierte importes exactos', () => {
    expect(toCents(28.5)).toBe(2850)
  })

  it('redondea al centavo más cercano', () => {
    expect(toCents(19.999)).toBe(2000)
  })

  it('rechaza importes negativos o no finitos', () => {
    expect(() => toCents(-1)).toThrow(RangeError)
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})
