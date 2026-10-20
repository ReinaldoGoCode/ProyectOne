import type { DeliveryMethod } from './types'

/** Tarifas ficticias de la demo, en centavos de dólar. */
export const SHIPPING_COSTS_CENTS: Readonly<Record<DeliveryMethod, number>> = {
  delivery_local: 300,
  envio_nacional: 500,
  retiro: 0,
}

export function getShippingCents(method: DeliveryMethod): number {
  return SHIPPING_COSTS_CENTS[method]
}

export function requiresAddress(method: DeliveryMethod): boolean {
  return method !== 'retiro'
}

export function requiresAgency(method: DeliveryMethod): boolean {
  return method === 'envio_nacional'
}
