import { createContext, useContext } from 'react'

import type { CreateOrderInput } from '@/domain/order'
import type { Order } from '@/domain/types'

export interface OrderContextValue {
  readonly orders: readonly Order[]
  readonly create: (input: Omit<CreateOrderInput, 'code'>) => Order | null
  readonly save: (order: Order) => boolean
  readonly reset: () => void
}

export const OrderContext = createContext<OrderContextValue | null>(null)

export function useOrders(): OrderContextValue {
  const context = useContext(OrderContext)

  if (context === null) {
    throw new Error('useOrders debe usarse dentro de OrderProvider')
  }

  return context
}
