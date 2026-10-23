import type { Catalog, InventoryMovement } from '@/domain/types'

import { seedCatalog } from '../seed'
import { parseCatalog, parseInventoryMovements } from '../schemas'
import { STORAGE_KEYS, getBrowserStorage, readJson, removeStoredValue, writeJson } from '../storage'
import type { KeyValueStorage } from '../storage'

export interface CatalogRepository {
  load(): Catalog
  save(catalog: Catalog): boolean
  loadInventoryMovements(): readonly InventoryMovement[]
  saveSnapshot(catalog: Catalog, movements: readonly InventoryMovement[]): boolean
  reset(): void
}

export function createCatalogRepository(
  storage: KeyValueStorage | null = getBrowserStorage(),
): CatalogRepository {
  return {
    load() {
      const snapshot = readJson(storage, STORAGE_KEYS.catalogSnapshot)
      if (typeof snapshot === 'object' && snapshot !== null && !Array.isArray(snapshot)) {
        const value = snapshot as Record<string, unknown>
        const catalog = parseCatalog(value['catalog'])
        const movements = parseInventoryMovements(value['inventoryMovements'])
        if (catalog && movements) return catalog
        removeStoredValue(storage, STORAGE_KEYS.catalogSnapshot)
      }
      const raw = readJson(storage, STORAGE_KEYS.catalog)

      if (raw === null) {
        removeStoredValue(storage, STORAGE_KEYS.catalog)
        return seedCatalog
      }

      const parsed = parseCatalog(raw)

      if (parsed === null) {
        removeStoredValue(storage, STORAGE_KEYS.catalog)
        return seedCatalog
      }

      return parsed
    },
    save(catalog) {
      return writeJson(storage, STORAGE_KEYS.catalogSnapshot, {
        catalog,
        inventoryMovements: this.loadInventoryMovements(),
      })
    },
    loadInventoryMovements() {
      const snapshot = readJson(storage, STORAGE_KEYS.catalogSnapshot)
      if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) return []
      return (
        parseInventoryMovements((snapshot as Record<string, unknown>)['inventoryMovements']) ?? []
      )
    },
    saveSnapshot(catalog, inventoryMovements) {
      const saved = writeJson(storage, STORAGE_KEYS.catalogSnapshot, {
        catalog,
        inventoryMovements,
      })
      if (saved) removeStoredValue(storage, STORAGE_KEYS.catalog)
      return saved
    },
    reset() {
      removeStoredValue(storage, STORAGE_KEYS.catalog)
      removeStoredValue(storage, STORAGE_KEYS.catalogSnapshot)
    },
  }
}
