import type { Catalog } from '@/domain/types'

import { seedCatalog } from '../seed'
import { parseCatalog } from '../schemas'
import { STORAGE_KEYS, getBrowserStorage, readJson, removeStoredValue, writeJson } from '../storage'
import type { KeyValueStorage } from '../storage'

export interface CatalogRepository {
  load(): Catalog
  save(catalog: Catalog): boolean
  reset(): void
}

export function createCatalogRepository(
  storage: KeyValueStorage | null = getBrowserStorage(),
): CatalogRepository {
  return {
    load() {
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
      return writeJson(storage, STORAGE_KEYS.catalog, catalog)
    },
    reset() {
      removeStoredValue(storage, STORAGE_KEYS.catalog)
    },
  }
}
