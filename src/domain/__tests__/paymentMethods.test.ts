import { describe, expect, it } from 'vitest'

import { isRemoteManualPaymentMethod, REMOTE_MANUAL_PAYMENT_METHODS } from '@/domain/paymentMethods'

describe('métodos manuales admitidos por checkout remoto', () => {
  it('acepta cada método manual que puede habilitar el administrador', () => {
    expect(REMOTE_MANUAL_PAYMENT_METHODS).toEqual([
      'pago_movil',
      'transferencia',
      'efectivo_ves',
      'efectivo_usd',
    ])
    for (const method of REMOTE_MANUAL_PAYMENT_METHODS) {
      expect(isRemoteManualPaymentMethod(method)).toBe(true)
    }
  })

  it('rechaza métodos antiguos y proveedores sin integración', () => {
    expect(isRemoteManualPaymentMethod('efectivo')).toBe(false)
    expect(isRemoteManualPaymentMethod('paypal')).toBe(false)
    expect(isRemoteManualPaymentMethod(null)).toBe(false)
  })
})
