import { normalizeOrderCode } from '@/domain/order'
import type { Order } from '@/domain/types'

import { parseOrders } from '../schemas'
import { STORAGE_KEYS, getBrowserStorage, readJson, removeStoredValue, writeJson } from '../storage'
import type { KeyValueStorage } from '../storage'

export interface OrderRepository {
  list(): readonly Order[]
  findByCode(code: string): Order | undefined
  save(order: Order): boolean
  reset(): void
}

export function createOrderRepository(
  storage: KeyValueStorage | null = getBrowserStorage(),
): OrderRepository {
  function list(): readonly Order[] {
    const raw = readJson(storage, STORAGE_KEYS.orders)

    if (raw === null) {
      removeStoredValue(storage, STORAGE_KEYS.orders)
      return []
    }

    const parsed = parseOrders(raw)

    if (parsed === null) {
      removeStoredValue(storage, STORAGE_KEYS.orders)
      return []
    }

    return [...parsed].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  return {
    list,
    findByCode(code) {
      const normalized = normalizeOrderCode(code)
      return list().find((order) => order.code === normalized)
    },
    save(order) {
      const orders = list()
      const index = orders.findIndex((item) => item.id === order.id)
      const next =
        index >= 0
          ? orders.map((item) => (item.id === order.id ? order : item))
          : [order, ...orders]

      return writeJson(storage, STORAGE_KEYS.orders, next)
    },
    reset() {
      removeStoredValue(storage, STORAGE_KEYS.orders)
    },
  }
}
