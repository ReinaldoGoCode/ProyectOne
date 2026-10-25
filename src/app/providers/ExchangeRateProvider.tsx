import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { requestRemoteBcvRate } from '@/data/repositories/remoteOrderGateway'
import type { RemoteBcvRateStatus } from '@/data/repositories/remoteOrderGateway'
import { ExchangeRateContext } from './exchangeRateContext'

export function ExchangeRateProvider({ children }: { readonly children: ReactNode }) {
  const [status, setStatus] = useState<RemoteBcvRateStatus>({ rate: null, warning: null })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setStatus(await requestRemoteBcvRate())
    } catch {
      setStatus({
        rate: null,
        warning: 'No se pudo consultar la tasa BCV guardada. Los importes se muestran solo en USD.',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const firstRefresh = window.setTimeout(() => {
      void refresh()
    }, 0)
    const timer = window.setInterval(
      () => {
        void refresh()
      },
      60 * 60 * 1000,
    )
    return () => {
      window.clearTimeout(firstRefresh)
      window.clearInterval(timer)
    }
  }, [refresh])

  return (
    <ExchangeRateContext.Provider value={{ ...status, loading }}>
      {children}
    </ExchangeRateContext.Provider>
  )
}
