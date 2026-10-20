import type { CartLine, Catalog } from '@/domain/types'
import { sanitizeCartLines } from '@/domain/cart'

import { STORAGE_KEYS, getBrowserStorage, readJson, removeStoredValue, writeJson } from '../storage'
import type { KeyValueStorage } from '../storage'

export interface CartRepository {
  load(catalog: Catalog): readonly CartLine[]
  save(lines: readonly CartLine[], catalog: Catalog): boolean
  reset(): void
}

export function createCartRepository(
  storage: KeyValueStorage | null = getBrowserStorage(),
): CartRepository {
  return {
    load(catalog) {
      const raw = readJson(storage, STORAGE_KEYS.cart)

      if (raw === null) {
        removeStoredValue(storage, STORAGE_KEYS.cart)
        return []
      }

      const lines = sanitizeCartLines(raw, catalog)
      if (!Array.isArray(raw)) removeStoredValue(storage, STORAGE_KEYS.cart)
      return lines
    },
    save(lines, catalog) {
      const safeLines = sanitizeCartLines(lines, catalog)
      return writeJson(storage, STORAGE_KEYS.cart, safeLines)
    },
    reset() {
      removeStoredValue(storage, STORAGE_KEYS.cart)
    },
  }
}
