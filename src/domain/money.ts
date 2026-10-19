/**
 * Utilidades de dinero.
 *
 * Los montos viven como enteros en centavos. Formatear es lo último que se
 * hace y convertir a unidades es lo primero que se evita: sumar `number` con
 * decimales arrastra errores de coma flotante (`0.1 + 0.2`).
 */

export const CENTS_PER_UNIT = 100

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-VE', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Un monto válido es un entero seguro y no negativo de centavos. */
export function isValidCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function assertCents(value: number, label: string): void {
  if (!isValidCents(value)) {
    throw new RangeError(
      `${label} debe ser un entero de centavos mayor o igual a 0. Recibido: ${String(value)}`,
    )
  }
}

/**
 * Convierte un importe en unidades (ej. 19.99) a centavos enteros.
 * Se usa al leer precios escritos por una persona, nunca en las sumas.
 */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(
      `El importe debe ser un número finito y no negativo. Recibido: ${String(amount)}`,
    )
  }

  return Math.round(amount * CENTS_PER_UNIT)
}

/** Formatea centavos como `$19,99` usando la convención de Venezuela. */
export function formatMoney(cents: number): string {
  assertCents(cents, 'El monto')
  return CURRENCY_FORMATTER.format(cents / CENTS_PER_UNIT)
}

/** Suma montos en centavos y falla si alguno es inválido o si hay desbordamiento. */
export function sumCents(values: readonly number[]): number {
  let total = 0

  for (const value of values) {
    assertCents(value, 'Cada monto')
    total += value

    if (!Number.isSafeInteger(total)) {
      throw new RangeError('La suma de centavos excede el rango entero seguro de JavaScript')
    }
  }

  return total
}

/** Multiplica un precio unitario por una cantidad entera no negativa. */
export function multiplyCents(cents: number, quantity: number): number {
  assertCents(cents, 'El precio unitario')

  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError(
      `La cantidad debe ser un entero mayor o igual a 0. Recibida: ${String(quantity)}`,
    )
  }

  const total = cents * quantity

  if (!Number.isSafeInteger(total)) {
    throw new RangeError('El total en centavos excede el rango entero seguro de JavaScript')
  }

  return total
}
