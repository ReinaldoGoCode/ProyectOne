export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const STORAGE_KEYS = {
  catalog: 'norte-moda:catalog:v1',
  catalogSnapshot: 'norte-moda:catalog-snapshot:v1',
  orders: 'norte-moda:orders:v1',
  cart: 'norte-moda:cart:v1',
} as const

/** Devuelve localStorage solo en el navegador y sin romper en modo privado. */
export function getBrowserStorage(): KeyValueStorage | null {
  try {
    if (typeof window === 'undefined') {
      return null
    }

    return window.localStorage
  } catch {
    return null
  }
}

export function readJson(storage: KeyValueStorage | null, key: string): unknown {
  if (storage === null) {
    return null
  }

  try {
    const raw = storage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function writeJson(storage: KeyValueStorage | null, key: string, value: unknown): boolean {
  if (storage === null) {
    return false
  }

  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeStoredValue(storage: KeyValueStorage | null, key: string): void {
  try {
    storage?.removeItem(key)
  } catch {
    // Un almacenamiento bloqueado no debe romper la aplicación.
  }
}

/** Restaura la demo: catálogo, pedidos y carrito vuelven a su estado inicial. */
export function resetDemoData(storage: KeyValueStorage | null = getBrowserStorage()): void {
  removeStoredValue(storage, STORAGE_KEYS.catalog)
  removeStoredValue(storage, STORAGE_KEYS.catalogSnapshot)
  removeStoredValue(storage, STORAGE_KEYS.orders)
  removeStoredValue(storage, STORAGE_KEYS.cart)
}
