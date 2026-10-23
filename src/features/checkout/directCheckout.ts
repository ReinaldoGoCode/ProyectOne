import type { CartLine, Catalog } from '@/domain/types'

const STORAGE_PREFIX = 'norte-moda:direct-checkout:'
const INTENT_MAX_AGE_MS = 24 * 60 * 60 * 1000

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function isSessionStorageLike(value: unknown): value is SessionStorageLike {
  if (typeof value !== 'object' || value === null) return false
  if (!('getItem' in value) || !('setItem' in value) || !('removeItem' in value)) return false
  return (
    typeof value.getItem === 'function' &&
    typeof value.setItem === 'function' &&
    typeof value.removeItem === 'function'
  )
}

interface StoredDirectCheckoutIntent {
  readonly version: 1
  readonly variantId: string
  readonly quantity: number
  readonly createdAt: number
  readonly credentials?: DirectCheckoutCredentials
}

export interface DirectCheckoutIntent {
  readonly variantId: string
  readonly quantity: number
  readonly createdAt: number
}

export interface DirectCheckoutCredentials {
  readonly idempotencyKey: string
  readonly trackingToken: string
}

export type DirectCheckoutSelection =
  | { readonly status: 'ready'; readonly line: CartLine; readonly productSlug: string }
  | { readonly status: 'unavailable'; readonly message: string; readonly productSlug?: string }

function getSessionStorage(): SessionStorageLike | null {
  try {
    const storage: unknown = Reflect.get(globalThis, 'sessionStorage')
    return isSessionStorageLike(storage) ? storage : null
  } catch {
    return null
  }
}

function getStorage(storage?: SessionStorageLike | null): SessionStorageLike | null {
  return storage === undefined ? getSessionStorage() : storage
}

function isIntentToken(value: string): boolean {
  return /^[a-f\d-]{36}$/i.test(value)
}

function createIntentToken(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function isCredentials(value: unknown): value is DirectCheckoutCredentials {
  if (typeof value !== 'object' || value === null) return false
  if (!('idempotencyKey' in value) || !('trackingToken' in value)) return false
  return (
    typeof value.idempotencyKey === 'string' &&
    /^[a-f\d-]{36}$/i.test(value.idempotencyKey) &&
    typeof value.trackingToken === 'string' &&
    /^[a-f\d]{64}$/i.test(value.trackingToken)
  )
}

function isStoredIntent(value: unknown): value is StoredDirectCheckoutIntent {
  if (typeof value !== 'object' || value === null) return false
  if (!('version' in value) || value.version !== 1) return false
  if (!('variantId' in value) || typeof value.variantId !== 'string' || value.variantId === '')
    return false
  if (!('quantity' in value) || typeof value.quantity !== 'number') return false
  if (!Number.isSafeInteger(value.quantity) || value.quantity <= 0) return false
  if (!('createdAt' in value) || typeof value.createdAt !== 'number') return false
  if (!Number.isFinite(value.createdAt)) return false
  if ('credentials' in value && !isCredentials(value.credentials)) return false
  return true
}

function readStoredIntent(
  token: string,
  storage: SessionStorageLike,
): StoredDirectCheckoutIntent | null {
  if (!isIntentToken(token)) return null

  const key = `${STORAGE_PREFIX}${token}`
  try {
    const raw = storage.getItem(key)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredIntent(parsed)) {
      storage.removeItem(key)
      return null
    }

    const age = Date.now() - parsed.createdAt
    if (age < -5 * 60 * 1000 || age > INTENT_MAX_AGE_MS) {
      storage.removeItem(key)
      return null
    }

    return parsed
  } catch {
    return null
  }
}

/** Saves only the selected variant and quantity in this tab's session storage. */
export function createDirectCheckoutIntent(
  variantId: string,
  quantity: number,
  storage?: SessionStorageLike | null,
): string | null {
  const targetStorage = getStorage(storage)
  if (
    targetStorage === null ||
    variantId.trim() === '' ||
    !Number.isSafeInteger(quantity) ||
    quantity <= 0
  ) {
    return null
  }

  try {
    const token = createIntentToken()
    targetStorage.setItem(
      `${STORAGE_PREFIX}${token}`,
      JSON.stringify({ version: 1, variantId, quantity, createdAt: Date.now() }),
    )
    return token
  } catch {
    return null
  }
}

/** Retrieves a direct checkout intent after route navigation or a page refresh. */
export function readDirectCheckoutIntent(
  token: string,
  storage?: SessionStorageLike | null,
): DirectCheckoutIntent | null {
  const targetStorage = getStorage(storage)
  if (targetStorage === null) return null
  const intent = readStoredIntent(token, targetStorage)
  if (intent === null) return null

  return {
    variantId: intent.variantId,
    quantity: intent.quantity,
    createdAt: intent.createdAt,
  }
}

/** Rechecks product state and stock against the current catalog. */
export function resolveDirectCheckoutSelection(
  catalog: Catalog,
  variantId: string,
  quantity: number,
): DirectCheckoutSelection {
  const variant = catalog.variants.find((item) => item.id === variantId)
  if (!variant) {
    return { status: 'unavailable', message: 'Esta variante ya no está disponible.' }
  }

  const product = catalog.products.find((item) => item.id === variant.productId)
  if (!product?.active) {
    return {
      status: 'unavailable',
      message: 'Este producto ya no está disponible para la venta.',
      ...(product ? { productSlug: product.slug } : {}),
    }
  }

  if (variant.stock <= 0) {
    return {
      status: 'unavailable',
      message: 'La variante elegida está agotada. El carrito que ya tenías sigue intacto.',
      productSlug: product.slug,
    }
  }

  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > variant.stock) {
    return {
      status: 'unavailable',
      message: `Elige una cantidad entre 1 y ${String(variant.stock)} unidades disponibles.`,
      productSlug: product.slug,
    }
  }

  return {
    status: 'ready',
    line: { variantId: variant.id, quantity },
    productSlug: product.slug,
  }
}

/** Keeps remote checkout retry credentials stable across refreshes in this tab. */
export function getOrCreateDirectCheckoutCredentials(
  token: string,
  create: () => DirectCheckoutCredentials,
  storage?: SessionStorageLike | null,
): DirectCheckoutCredentials | null {
  const targetStorage = getStorage(storage)
  if (targetStorage === null) return null

  const intent = readStoredIntent(token, targetStorage)
  if (intent === null) return null
  if (intent.credentials) return intent.credentials

  try {
    const credentials = create()
    if (!isCredentials(credentials)) return null
    targetStorage.setItem(`${STORAGE_PREFIX}${token}`, JSON.stringify({ ...intent, credentials }))
    return credentials
  } catch {
    return null
  }
}

export function clearDirectCheckoutIntent(
  token: string,
  storage?: SessionStorageLike | null,
): void {
  const targetStorage = getStorage(storage)
  if (targetStorage === null || !isIntentToken(token)) return
  try {
    targetStorage.removeItem(`${STORAGE_PREFIX}${token}`)
  } catch {
    // The order is already saved; an inaccessible session store must not undo it.
  }
}
