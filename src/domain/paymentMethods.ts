/** Manual methods accepted by the remote checkout and its PostgreSQL schema. */
export const REMOTE_MANUAL_PAYMENT_METHODS = [
  'pago_movil',
  'transferencia',
  'efectivo_ves',
  'efectivo_usd',
] as const

export type RemoteManualPaymentMethod = (typeof REMOTE_MANUAL_PAYMENT_METHODS)[number]

export function isRemoteManualPaymentMethod(value: unknown): value is RemoteManualPaymentMethod {
  return (
    typeof value === 'string' &&
    REMOTE_MANUAL_PAYMENT_METHODS.includes(value as RemoteManualPaymentMethod)
  )
}
