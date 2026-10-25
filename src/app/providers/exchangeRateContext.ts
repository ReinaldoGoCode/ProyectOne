import { createContext, useContext } from 'react'

import type { RemoteBcvRateStatus } from '@/data/repositories/remoteOrderGateway'

export interface ExchangeRateContextValue extends RemoteBcvRateStatus {
  readonly loading: boolean
}

export const ExchangeRateContext = createContext<ExchangeRateContextValue>({
  rate: null,
  warning: null,
  loading: false,
})

export function useExchangeRate(): ExchangeRateContextValue {
  return useContext(ExchangeRateContext)
}
