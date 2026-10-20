import { useState } from 'react'
import type { ReactNode } from 'react'

import { createOrderRepository } from '@/data/repositories/orderRepository'
import { createOrder, nextOrderCode } from '@/domain/order'

import { OrderContext } from './orderContext'
import type { CreateOrderInput } from '@/domain/order'

export function OrderProvider({ children }: { readonly children: ReactNode }) {
  const [repository] = useState(() => createOrderRepository())
  const [orders, setOrders] = useState(() => repository.list())

  function save(order: (typeof orders)[number]): boolean {
    const saved = repository.save(order)
    if (saved) setOrders(repository.list())
    return saved
  }

  function create(input: Omit<CreateOrderInput, 'code'>) {
    try {
      const order = createOrder({ ...input, code: nextOrderCode(orders) })
      return save(order) ? order : null
    } catch {
      return null
    }
  }

  function reset(): void {
    repository.reset()
    setOrders([])
  }

  return (
    <OrderContext.Provider value={{ orders, create, save, reset }}>
      {children}
    </OrderContext.Provider>
  )
}
