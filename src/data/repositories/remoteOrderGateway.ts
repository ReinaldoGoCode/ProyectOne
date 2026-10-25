import type {
  Catalog,
  Customer,
  DeliveryMethod,
  InventoryMovement,
  Order,
  PaymentMethod,
  ShippingAddress,
  Size,
} from '@/domain/types'
import { BCV_SOURCE_URL } from '@/domain/exchangeRate'
import type { PublicBcvRate } from '@/domain/exchangeRate'
import { parseCatalog, parseOrders } from '@/data/schemas'

import { getSupabaseBrowserClient } from '@/lib/supabase'

export interface RemoteExchangeQuote {
  readonly id: string
  readonly vesPerUsd: string
  readonly source: 'bcv'
  readonly quotedAt: string
  readonly expiresAt: string
  readonly effectiveDate: string
  readonly sourceUrl: string
  readonly retrievedAt: string
  readonly rateWarning: boolean
}

export interface RemoteOrderDraft {
  readonly idempotencyKey: string
  /** 256-bit random secret; store it only in the buyer's private order link. */
  readonly trackingToken: string
  readonly quoteId: string
  readonly expectedSubtotalCents: number
  readonly expectedShippingCents: number
  readonly expectedTotalCents: number
  readonly expectedVesTotalCents: number
  readonly customer: Customer
  readonly deliveryMethod: DeliveryMethod
  readonly shippingAddress: ShippingAddress | null
  readonly shippingAgency: string | null
  readonly paymentMethod: PaymentMethod
  readonly customerNote: string | null
  readonly whatsappOptIn: boolean
  readonly items: readonly { readonly variantId: string; readonly quantity: number }[]
}

export interface RemoteWhatsAppPurchaseContext {
  readonly reference: string
  readonly expiresAt: string
  readonly prefilledMessage: string
  readonly whatsappUrl: string | null
  readonly product: {
    readonly slug: string
    readonly name: string
    readonly size: string
    readonly color: string
    readonly quantity: number
    readonly unitPriceCents: number
    readonly stock: number
  }
}

export interface RemoteCheckoutQuote extends RemoteExchangeQuote {
  readonly subtotalCents: number
  readonly shippingCents: number
  readonly totalCents: number
  readonly vesTotalCents: number
  readonly items: readonly {
    readonly variantId: string
    readonly productName: string
    readonly size: Size
    readonly color: string
    readonly sku: string
    readonly quantity: number
    readonly unitPriceCents: number
    readonly lineTotalCents: number
    readonly stockAvailable: number
  }[]
}

export interface RemoteBcvRateStatus {
  readonly rate: PublicBcvRate | null
  readonly warning: string | null
}

export interface RemoteOrderCredentials {
  readonly idempotencyKey: string
  readonly trackingToken: string
}

export interface RemoteOrderReceipt {
  readonly id: string
  readonly code: string
  readonly createdAt: string
  readonly subtotalCents: number
  readonly shippingCents: number
  readonly totalCents: number
  readonly vesPerUsd: string
  readonly vesTotalCents: number
}

export interface RemoteAdminOrder {
  readonly id: string
  readonly code: string
  readonly createdAt: string
  readonly customer: {
    readonly firstName: string
    readonly lastName: string
    readonly phone: string
  }
  readonly deliveryMethod: 'delivery_local' | 'envio_nacional' | 'retiro'
  readonly shippingAgency: string | null
  readonly shippingCompany: string | null
  readonly shippingTrackingNumber: string | null
  readonly shippingNotes: string | null
  readonly totalCents: number
  readonly paymentReference: string | null
  readonly paymentReportedAmountCents: number | null
  readonly paymentReportedCurrency: 'VES' | 'USD' | null
  readonly paymentPaidAt: string | null
  readonly paymentNote: string | null
  readonly paymentAmountMatches: boolean | null
  readonly paymentReceiptAvailable: boolean
  readonly orderStatus: 'awaiting_payment' | 'confirmed' | 'inventory_exception' | 'cancelled'
  readonly paymentStatus: 'pending' | 'review' | 'paid' | 'rejected' | 'cancelled'
  readonly fulfillmentStatus: 'new' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'
  readonly items: readonly {
    readonly productName: string
    readonly size: string
    readonly color: string
    readonly quantity: number
  }[]
}

export interface RemoteAdminDashboardSummary {
  readonly period: { readonly from: string; readonly to: string }
  readonly ordersReceived: number
  readonly confirmedSalesCount: number
  readonly confirmedSalesCents: number
  readonly pendingPaymentCount: number
  readonly pendingPaymentCents: number
  readonly paidBalanceCents: number
  readonly pendingBalanceCents: number
  readonly preparationBacklogCount: number
  readonly activeProductCount: number
  readonly availableVariantCount: number
  readonly lowStockVariantCount: number
  readonly lowStockVariants: readonly {
    readonly variantId: string
    readonly sku: string
    readonly productName: string
    readonly size: string
    readonly color: string
    readonly stock: number
  }[]
  readonly topSellers: readonly {
    readonly productId: string
    readonly productName: string
    readonly quantity: number
    readonly revenueCents: number
  }[]
}

export interface RemoteWhatsAppHandoff {
  readonly id: string
  readonly senderPhone: string
  readonly orderCode: string | null
  readonly reason:
    | 'human_requested'
    | 'payment_instructions_missing'
    | 'unknown_request'
    | 'payment_reference_submitted'
    | 'shipping_exception'
    | 'stock_exception'
  readonly status: 'open' | 'claimed' | 'resolved'
  readonly createdAt: string
}

export interface RemoteAdminCatalog {
  readonly catalog: Catalog
  readonly movements: readonly InventoryMovement[]
}

export interface RemoteInventoryImportResult {
  readonly createdProducts: number
  readonly createdVariants: number
  readonly changedVariants: number
}

export type ConfigurablePaymentMethod =
  | 'pago_movil'
  | 'transferencia'
  | 'efectivo_ves'
  | 'efectivo_usd'
  | 'paypal'
  | 'binance_pay'
  | 'card'

export interface RemoteAdminPaymentMethod {
  readonly method: ConfigurablePaymentMethod
  readonly label: string
  readonly kind: 'manual' | 'provider'
  readonly active: boolean
  readonly instructions: string
  readonly providerReady: boolean
}

export interface RemoteStorePaymentOption {
  readonly method: 'pago_movil' | 'transferencia' | 'efectivo_ves' | 'efectivo_usd'
  readonly label: string
  readonly instructions: string
}

/** Generate once per checkout attempt and retain unchanged for safe retries. */
export function createRemoteOrderCredentials(): RemoteOrderCredentials {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const trackingToken = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return { idempotencyKey: crypto.randomUUID(), trackingToken }
}

export async function requestRemoteBcvRate(): Promise<RemoteBcvRateStatus> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('exchange-rate', { method: 'GET' })
  const payload: unknown = response.data
  if (response.error || !isRecord(payload)) {
    throw new Error('No se pudo consultar la tasa BCV guardada.')
  }
  const warning = typeof payload['warning'] === 'string' ? payload['warning'] : null
  const rawRate = payload['rate']
  if (rawRate === null) return { rate: null, warning }
  if (
    !isRecord(rawRate) ||
    typeof rawRate['vesPerUsd'] !== 'string' ||
    !/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(rawRate['vesPerUsd']) ||
    typeof rawRate['effectiveDate'] !== 'string' ||
    rawRate['sourceUrl'] !== BCV_SOURCE_URL ||
    typeof rawRate['retrievedAt'] !== 'string' ||
    typeof rawRate['isStale'] !== 'boolean' ||
    !(rawRate['warning'] === null || typeof rawRate['warning'] === 'string')
  ) {
    throw new Error('La respuesta de tasa BCV no es válida.')
  }
  return {
    rate: {
      vesPerUsd: rawRate['vesPerUsd'],
      effectiveDate: rawRate['effectiveDate'],
      sourceUrl: rawRate['sourceUrl'],
      retrievedAt: rawRate['retrievedAt'],
      isStale: rawRate['isStale'],
      warning: rawRate['warning'],
    },
    warning,
  }
}

export async function requestRemoteCheckoutQuote(input: {
  readonly items: readonly { readonly variantId: string; readonly quantity: number }[]
  readonly deliveryMethod: DeliveryMethod
}): Promise<RemoteCheckoutQuote> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('checkout-quote', { body: input })
  const payload: unknown = response.data
  if (response.error) {
    throw new Error(
      await describeFunctionError(
        response.error,
        'No se pudo validar el importe, las existencias y la tasa BCV en el servidor.',
      ),
    )
  }
  if (!isRecord(payload) || !isRecord(payload['quote'])) {
    throw new Error('No se pudo validar el importe y las existencias en el servidor.')
  }
  const raw = payload['quote']
  const items = parseRemoteQuoteItems(raw['items'])
  if (
    typeof raw['id'] !== 'string' ||
    typeof raw['vesPerUsd'] !== 'string' ||
    raw['source'] !== 'bcv' ||
    typeof raw['quotedAt'] !== 'string' ||
    typeof raw['expiresAt'] !== 'string' ||
    typeof raw['effectiveDate'] !== 'string' ||
    typeof raw['sourceUrl'] !== 'string' ||
    typeof raw['retrievedAt'] !== 'string' ||
    typeof raw['rateWarning'] !== 'boolean' ||
    !Number.isSafeInteger(raw['subtotalCents']) ||
    !Number.isSafeInteger(raw['shippingCents']) ||
    !Number.isSafeInteger(raw['totalCents']) ||
    !Number.isSafeInteger(raw['vesTotalCents']) ||
    items === null
  ) {
    throw new Error('La respuesta de cotización no es válida.')
  }
  return {
    id: raw['id'],
    vesPerUsd: raw['vesPerUsd'],
    source: raw['source'],
    quotedAt: raw['quotedAt'],
    expiresAt: raw['expiresAt'],
    effectiveDate: raw['effectiveDate'],
    sourceUrl: raw['sourceUrl'],
    retrievedAt: raw['retrievedAt'],
    rateWarning: raw['rateWarning'],
    subtotalCents: raw['subtotalCents'] as number,
    shippingCents: raw['shippingCents'] as number,
    totalCents: raw['totalCents'] as number,
    vesTotalCents: raw['vesTotalCents'] as number,
    items,
  }
}

export async function createRemoteOrder(draft: RemoteOrderDraft): Promise<{
  readonly order: RemoteOrderReceipt
  readonly trackingToken: string
}> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('create-order', { body: draft })
  const payload: unknown = response.data
  if (response.error) {
    const context: unknown = Object.getOwnPropertyDescriptor(response.error, 'context')?.value
    if (context instanceof Response) {
      const failure: unknown = await context
        .clone()
        .json()
        .catch(() => null)
      if (isRecord(failure) && typeof failure['error'] === 'string') {
        throw new Error(failure['error'])
      }
    }
  }
  if (
    response.error ||
    !isRecord(payload) ||
    !isRecord(payload['order']) ||
    typeof payload['trackingToken'] !== 'string'
  ) {
    if (isRecord(payload) && typeof payload['error'] === 'string') {
      throw new Error(payload['error'])
    }
    throw new Error('No se pudo guardar el pedido remoto.')
  }
  const order = payload['order']
  const receipt = parseReceipt(order)
  if (!receipt) throw new Error('El servidor devolvió un pedido inválido.')
  return { order: receipt, trackingToken: payload['trackingToken'] }
}

/** Creates a short-lived, server-verified product reference for WhatsApp. */
export async function createRemoteWhatsAppPurchaseContext(input: {
  readonly variantId: string
  readonly quantity: number
}): Promise<RemoteWhatsAppPurchaseContext> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('El backend todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('create-whatsapp-purchase-context', {
    body: input,
  })
  const payload: unknown = response.data
  if (response.error || !isRecord(payload) || !isRecord(payload['product'])) {
    if (isRecord(payload) && typeof payload['error'] === 'string') {
      throw new Error(payload['error'])
    }
    throw new Error('No se pudo preparar una consulta de compra segura.')
  }
  const context = parseRemoteWhatsAppPurchaseContext(payload)
  if (!context) throw new Error('El servidor devolvió un contexto de WhatsApp inválido.')
  return context
}

export function parseRemoteWhatsAppPurchaseContext(
  value: unknown,
): RemoteWhatsAppPurchaseContext | null {
  if (!isRecord(value) || !isRecord(value['product'])) return null
  const product = value['product']
  if (
    typeof value['reference'] !== 'string' ||
    !/^NM-C-[0-9a-f]{64}$/i.test(value['reference']) ||
    typeof value['expiresAt'] !== 'string' ||
    !Number.isFinite(Date.parse(value['expiresAt'])) ||
    Date.parse(value['expiresAt']) <= Date.now() ||
    typeof value['prefilledMessage'] !== 'string' ||
    value['prefilledMessage'].length < 1 ||
    value['prefilledMessage'].length > 2000 ||
    !(value['whatsappUrl'] === null || isSafeWhatsAppUrl(value['whatsappUrl'])) ||
    typeof product['slug'] !== 'string' ||
    !/^[a-z0-9][a-z0-9-]{0,99}$/.test(product['slug']) ||
    typeof product['name'] !== 'string' ||
    product['name'].length < 1 ||
    product['name'].length > 200 ||
    typeof product['size'] !== 'string' ||
    product['size'].length < 1 ||
    product['size'].length > 20 ||
    typeof product['color'] !== 'string' ||
    product['color'].length < 1 ||
    product['color'].length > 100 ||
    !Number.isSafeInteger(product['quantity']) ||
    (product['quantity'] as number) < 1 ||
    (product['quantity'] as number) > 10 ||
    !Number.isSafeInteger(product['unitPriceCents']) ||
    (product['unitPriceCents'] as number) <= 0 ||
    !Number.isSafeInteger(product['stock']) ||
    (product['stock'] as number) < 0
  ) {
    return null
  }
  return {
    reference: value['reference'],
    expiresAt: value['expiresAt'],
    prefilledMessage: value['prefilledMessage'],
    whatsappUrl: value['whatsappUrl'],
    product: {
      slug: product['slug'],
      name: product['name'],
      size: product['size'],
      color: product['color'],
      quantity: product['quantity'] as number,
      unitPriceCents: product['unitPriceCents'] as number,
      stock: product['stock'] as number,
    },
  }
}

function isSafeWhatsAppUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' && url.hostname === 'wa.me' && /^\/[0-9]{8,15}$/.test(url.pathname)
    )
  } catch {
    return false
  }
}

export interface RemotePaymentReferenceResult {
  readonly paymentStatus: string
  readonly reference: string | null
  readonly submittedAt: string | null
  readonly alreadySubmitted: boolean
  readonly alreadyVerified: boolean
  readonly amountMatches: boolean | null
}

/** Records a buyer-supplied report; it never approves the payment. */
export async function submitRemotePaymentReport(input: {
  readonly code: string
  readonly trackingToken: string
  readonly reference: string
  readonly note: string
  readonly amountCents: number
  readonly paidAt: string
  readonly receipt: File | null
}): Promise<RemotePaymentReferenceResult> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const body = new FormData()
  body.set('code', input.code)
  body.set('trackingToken', input.trackingToken)
  body.set('reference', input.reference)
  body.set('note', input.note)
  body.set('amountCents', String(input.amountCents))
  body.set('currency', 'VES')
  body.set('paidAt', input.paidAt)
  if (input.receipt) body.set('receipt', input.receipt, input.receipt.name)
  const response = await client.functions.invoke<unknown>('submit-payment-reference', {
    body,
  })
  const payload: unknown = response.data
  if (response.error || !isRecord(payload) || !isRecord(payload['result'])) {
    if (isRecord(payload) && typeof payload['error'] === 'string') throw new Error(payload['error'])
    const context: unknown = response.error
      ? Object.getOwnPropertyDescriptor(response.error, 'context')?.value
      : null
    if (context instanceof Response) {
      const failure: unknown = await context
        .clone()
        .json()
        .catch(() => null)
      if (isRecord(failure) && typeof failure['error'] === 'string') {
        throw new Error(failure['error'])
      }
    }
    throw new Error('No se pudo registrar la referencia de pago.')
  }
  const result = parseRemotePaymentReferenceResult(payload['result'])
  if (!result) throw new Error('El servidor devolvió una respuesta de pago inválida.')
  return result
}

export function parseRemotePaymentReferenceResult(
  value: unknown,
): RemotePaymentReferenceResult | null {
  if (
    !isRecord(value) ||
    typeof value['paymentStatus'] !== 'string' ||
    !(value['reference'] === null || typeof value['reference'] === 'string') ||
    !(value['submittedAt'] === null || typeof value['submittedAt'] === 'string') ||
    typeof value['alreadySubmitted'] !== 'boolean' ||
    typeof value['alreadyVerified'] !== 'boolean' ||
    !(
      value['amountMatches'] === undefined ||
      value['amountMatches'] === null ||
      typeof value['amountMatches'] === 'boolean'
    )
  ) {
    return null
  }
  return {
    paymentStatus: value['paymentStatus'],
    reference: value['reference'],
    submittedAt: value['submittedAt'],
    alreadySubmitted: value['alreadySubmitted'],
    alreadyVerified: value['alreadyVerified'],
    amountMatches: typeof value['amountMatches'] === 'boolean' ? value['amountMatches'] : null,
  }
}

export async function getRemoteAdminPaymentReceipt(orderId: string): Promise<string> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('admin-payment-receipt', {
    body: { orderId },
  })
  const payload: unknown = response.data
  if (response.error || !isRecord(payload) || typeof payload['url'] !== 'string') {
    throw new Error('No se pudo abrir el comprobante privado.')
  }
  return payload['url']
}

export async function lookupRemoteOrder(code: string, trackingToken: string): Promise<Order> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('lookup-order', {
    body: { code, trackingToken },
  })
  const payload: unknown = response.data
  if (response.error || !isRecord(payload) || !('order' in payload)) {
    throw new Error('No se encontró el pedido o el enlace no es válido.')
  }
  const order = parseRemotePublicOrder(payload['order'])
  if (!order) throw new Error('Los datos de seguimiento no tienen un formato válido.')
  return order
}

/** Public read uses the database's active-product RLS policies. */
export async function loadRemotePublicCatalog(): Promise<Catalog> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const [categories, products] = await Promise.all([
    client.from('categories').select('id, slug, name, description').order('name'),
    client
      .from('products')
      .select(
        'id, slug, name, category_id, description, composition, care, price_cents, image_url, image_alt, active, created_at',
      )
      .order('name')
      .limit(5000),
  ])
  if (categories.error || products.error) {
    throw new Error('No se pudo conectar con el catálogo remoto.')
  }
  const rows: readonly unknown[] = toUnknownArray(products.data)
  const ids = rows
    .map((row) => (isRecord(row) ? row['id'] : null))
    .filter((id): id is string => typeof id === 'string')
  const variants = ids.length
    ? await client
        .from('variants')
        .select('id, product_id, size, color, sku, stock')
        .in('product_id', ids)
        .order('sku')
        .limit(5000)
    : { data: [], error: null }
  if (variants.error) throw new Error('No se pudieron consultar las variantes del catálogo.')
  const catalog = parseRemoteCatalog({
    categories: toUnknownArray(categories.data),
    products: rows,
    variants: toUnknownArray(variants.data),
  })
  if (!catalog) throw new Error('El catálogo remoto contiene datos inválidos.')
  return catalog
}

export async function listRemoteAdminOrders(): Promise<readonly RemoteAdminOrder[]> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('admin-orders', { method: 'GET' })
  if (response.error) {
    throw new Error(
      await describeFunctionError(response.error, 'No se pudieron cargar los pedidos.'),
    )
  }
  const data: unknown = response.data
  if (!isRecord(data) || !Array.isArray(data['orders'])) {
    throw new Error('La respuesta de pedidos no es válida.')
  }
  const rawOrders: readonly unknown[] = data['orders'] as unknown[]
  const parsed = rawOrders.map(parseAdminOrder)
  const orders = parsed.filter((order): order is RemoteAdminOrder => order !== null)
  if (orders.length !== rawOrders.length) throw new Error('Hay un pedido con formato no válido.')
  return orders
}

export async function getRemoteAdminDashboardSummary(
  from: string,
  to: string,
): Promise<RemoteAdminDashboardSummary> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('admin-dashboard', {
    body: { from, to },
  })
  if (response.error) {
    throw new Error(
      await describeFunctionError(response.error, 'No se pudo cargar el resumen administrativo.'),
    )
  }
  const payload: unknown = response.data
  if (!isRecord(payload)) throw new Error('La respuesta del resumen administrativo no es válida.')
  const summary = parseRemoteAdminDashboardSummary(payload['summary'])
  if (!summary) throw new Error('El resumen administrativo contiene datos no válidos.')
  return summary
}

export function parseRemoteAdminDashboardSummary(
  value: unknown,
): RemoteAdminDashboardSummary | null {
  if (!isRecord(value) || !isRecord(value['period'])) return null
  const period = value['period']
  if (typeof period['from'] !== 'string' || typeof period['to'] !== 'string') return null

  const integerFields = [
    'ordersReceived',
    'confirmedSalesCount',
    'confirmedSalesCents',
    'pendingPaymentCount',
    'pendingPaymentCents',
    'paidBalanceCents',
    'pendingBalanceCents',
    'preparationBacklogCount',
    'activeProductCount',
    'availableVariantCount',
    'lowStockVariantCount',
  ] as const
  const parsedIntegers = Object.fromEntries(
    integerFields.map((field) => [field, parseSafeInteger(value[field])]),
  ) as Record<(typeof integerFields)[number], number | null>
  if (!hasNonNegativeSafeIntegers(parsedIntegers)) return null
  if (!Array.isArray(value['lowStockVariants']) || !Array.isArray(value['topSellers'])) return null

  const lowStockVariants: RemoteAdminDashboardSummary['lowStockVariants'][number][] = []
  for (const item of value['lowStockVariants']) {
    if (
      !isRecord(item) ||
      typeof item['variantId'] !== 'string' ||
      typeof item['sku'] !== 'string' ||
      typeof item['productName'] !== 'string' ||
      typeof item['size'] !== 'string' ||
      typeof item['color'] !== 'string'
    ) {
      return null
    }
    const stock = parseSafeInteger(item['stock'])
    if (stock === null || stock < 0 || stock > 3) return null
    lowStockVariants.push({
      variantId: item['variantId'],
      sku: item['sku'],
      productName: item['productName'],
      size: item['size'],
      color: item['color'],
      stock,
    })
  }

  const topSellers: RemoteAdminDashboardSummary['topSellers'][number][] = []
  for (const item of value['topSellers']) {
    if (
      !isRecord(item) ||
      typeof item['productId'] !== 'string' ||
      typeof item['productName'] !== 'string'
    ) {
      return null
    }
    const quantity = parseSafeInteger(item['quantity'])
    const revenueCents = parseSafeInteger(item['revenueCents'])
    if (quantity === null || quantity < 1 || revenueCents === null || revenueCents < 0) return null
    topSellers.push({
      productId: item['productId'],
      productName: item['productName'],
      quantity,
      revenueCents,
    })
  }

  return {
    period: { from: period['from'], to: period['to'] },
    ordersReceived: parsedIntegers.ordersReceived,
    confirmedSalesCount: parsedIntegers.confirmedSalesCount,
    confirmedSalesCents: parsedIntegers.confirmedSalesCents,
    pendingPaymentCount: parsedIntegers.pendingPaymentCount,
    pendingPaymentCents: parsedIntegers.pendingPaymentCents,
    paidBalanceCents: parsedIntegers.paidBalanceCents,
    pendingBalanceCents: parsedIntegers.pendingBalanceCents,
    preparationBacklogCount: parsedIntegers.preparationBacklogCount,
    activeProductCount: parsedIntegers.activeProductCount,
    availableVariantCount: parsedIntegers.availableVariantCount,
    lowStockVariantCount: parsedIntegers.lowStockVariantCount,
    lowStockVariants,
    topSellers,
  }
}

export async function listRemoteAdminCatalog(): Promise<RemoteAdminCatalog> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('admin-catalog', { method: 'GET' })
  if (response.error) {
    throw new Error(
      await describeFunctionError(response.error, 'No se pudo cargar el catálogo administrativo.'),
    )
  }
  const payload: unknown = response.data
  if (!isRecord(payload)) throw new Error('La respuesta del catálogo no es válida.')
  const catalog = parseRemoteCatalog(payload)
  if (!catalog || !Array.isArray(payload['movements'])) {
    throw new Error('El catálogo administrativo contiene datos inválidos.')
  }
  const movements = payload['movements'].map(parseRemoteInventoryMovement)
  if (movements.some((movement) => movement === null)) {
    throw new Error('El historial de inventario contiene datos inválidos.')
  }
  return { catalog, movements: movements as InventoryMovement[] }
}

export async function applyRemoteInventoryImport(
  catalog: Catalog,
  expectedCatalog: Catalog,
): Promise<RemoteInventoryImportResult> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('admin-catalog', {
    body: {
      products: catalog.products,
      variants: catalog.variants.map((variant) => ({
        ...variant,
        expectedStock:
          expectedCatalog.variants.find((current) => current.id === variant.id)?.stock ?? null,
      })),
    },
  })
  if (response.error) {
    const context: unknown = Object.getOwnPropertyDescriptor(response.error, 'context')?.value
    if (context instanceof Response) {
      const failure: unknown = await context
        .clone()
        .json()
        .catch(() => null)
      if (isRecord(failure) && typeof failure['error'] === 'string') {
        throw new Error(failure['error'])
      }
    }
    throw new Error('No se pudo aplicar el inventario remoto.')
  }
  const payload: unknown = response.data
  if (!isRecord(payload) || !isRecord(payload['result'])) {
    throw new Error('El servidor devolvió un resultado de importación inválido.')
  }
  const result = payload['result']
  if (
    !Number.isSafeInteger(result['createdProducts']) ||
    !Number.isSafeInteger(result['createdVariants']) ||
    !Number.isSafeInteger(result['changedVariants'])
  ) {
    throw new Error('El servidor devolvió un resumen de importación inválido.')
  }
  return {
    createdProducts: result['createdProducts'] as number,
    createdVariants: result['createdVariants'] as number,
    changedVariants: result['changedVariants'] as number,
  }
}

export type RemoteStockAdjustmentMode = 'set' | 'add' | 'subtract'

export async function adjustRemoteVariantStock(
  variantId: string,
  mode: RemoteStockAdjustmentMode,
  quantity: number,
  note: string,
): Promise<{ readonly stock: number; readonly delta: number }> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('admin-catalog', {
    body: { action: 'stock', variantId, mode, quantity, note },
  })
  if (response.error) {
    const context: unknown = Object.getOwnPropertyDescriptor(response.error, 'context')?.value
    if (context instanceof Response) {
      const failure: unknown = await context
        .clone()
        .json()
        .catch(() => null)
      if (isRecord(failure) && typeof failure['error'] === 'string') {
        throw new Error(failure['error'])
      }
    }
    throw new Error('No se pudieron guardar las existencias.')
  }
  const payload: unknown = response.data
  if (
    !isRecord(payload) ||
    !isRecord(payload['result']) ||
    !Number.isSafeInteger(payload['result']['stock']) ||
    !Number.isSafeInteger(payload['result']['delta'])
  ) {
    throw new Error('El servidor devolvió un ajuste de existencias inválido.')
  }
  return {
    stock: payload['result']['stock'] as number,
    delta: payload['result']['delta'] as number,
  }
}

export async function uploadRemoteProductImage(
  productId: string,
  file: File,
): Promise<{ readonly imageUrl: string; readonly imageAlt: string }> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const form = new FormData()
  form.set('productId', productId)
  form.set('image', file)
  const response = await client.functions.invoke<unknown>('admin-product-image', { body: form })
  if (response.error) {
    const context: unknown = Object.getOwnPropertyDescriptor(response.error, 'context')?.value
    if (context instanceof Response) {
      const failure: unknown = await context
        .clone()
        .json()
        .catch(() => null)
      if (isRecord(failure) && typeof failure['error'] === 'string') {
        throw new Error(failure['error'])
      }
    }
    throw new Error('No se pudo guardar la imagen del producto.')
  }
  const payload: unknown = response.data
  if (
    !isRecord(payload) ||
    typeof payload['imageUrl'] !== 'string' ||
    typeof payload['imageAlt'] !== 'string'
  ) {
    throw new Error('El servidor devolvió una respuesta de imagen inválida.')
  }
  return { imageUrl: payload['imageUrl'], imageAlt: payload['imageAlt'] }
}

export async function requestRemotePaymentOptions(): Promise<readonly RemoteStorePaymentOption[]> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('store-payment-options', {
    method: 'GET',
  })
  const payload: unknown = response.data
  if (response.error || !isRecord(payload) || !Array.isArray(payload['methods'])) {
    throw new Error('No se pudieron cargar los métodos de pago configurados.')
  }
  const methods = payload['methods'].map(parseRemoteStorePaymentOption)
  if (methods.some((method) => method === null)) {
    throw new Error('El servidor devolvió métodos de pago inválidos.')
  }
  return methods as RemoteStorePaymentOption[]
}

export async function listRemoteAdminPaymentMethods(): Promise<
  readonly RemoteAdminPaymentMethod[]
> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('admin-payment-settings', {
    method: 'GET',
  })
  const payload: unknown = response.data
  if (response.error) {
    throw new Error(
      await describeFunctionError(response.error, 'No se pudieron cargar los métodos de pago.'),
    )
  }
  if (!isRecord(payload) || !Array.isArray(payload['methods'])) {
    throw new Error('La respuesta de métodos de pago no es válida.')
  }
  const methods = payload['methods'].map(parseRemoteAdminPaymentMethod)
  if (methods.some((method) => method === null) || methods.length !== 7) {
    throw new Error('La configuración de métodos de pago está incompleta.')
  }
  return methods as RemoteAdminPaymentMethod[]
}

export async function saveRemoteAdminPaymentMethods(
  methods: readonly Pick<RemoteAdminPaymentMethod, 'method' | 'active' | 'instructions'>[],
): Promise<readonly RemoteAdminPaymentMethod[]> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('admin-payment-settings', {
    body: { methods },
  })
  const payload: unknown = response.data
  if (response.error || !isRecord(payload) || !Array.isArray(payload['methods'])) {
    if (isRecord(payload) && typeof payload['error'] === 'string') throw new Error(payload['error'])
    throw new Error('No se pudo guardar la configuración de pagos.')
  }
  const updated = payload['methods'].map(parseRemoteAdminPaymentMethod)
  if (updated.some((method) => method === null) || updated.length !== 7) {
    throw new Error('El servidor devolvió una configuración inválida.')
  }
  return updated as RemoteAdminPaymentMethod[]
}

export async function listRemoteWhatsAppHandoffs(): Promise<readonly RemoteWhatsAppHandoff[]> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('admin-whatsapp-handoffs', {
    method: 'GET',
  })
  const data: unknown = response.data
  if (response.error) {
    throw new Error(
      await describeFunctionError(
        response.error,
        'No se pudieron cargar las solicitudes de WhatsApp.',
      ),
    )
  }
  if (!isRecord(data) || !Array.isArray(data['handoffs'])) {
    throw new Error('La respuesta de solicitudes de WhatsApp no es válida.')
  }
  const handoffs = data['handoffs'].map(parseRemoteWhatsAppHandoff)
  if (handoffs.some((handoff) => handoff === null)) {
    throw new Error('Hay una solicitud de WhatsApp con formato no válido.')
  }
  return handoffs as RemoteWhatsAppHandoff[]
}

export async function updateRemoteWhatsAppHandoff(
  id: string,
  status: 'claimed' | 'resolved',
): Promise<void> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('admin-whatsapp-handoffs', {
    body: { id, status },
  })
  if (response.error) throw new Error('No se pudo actualizar la solicitud de WhatsApp.')
}

function parseAdminOrder(value: unknown): RemoteAdminOrder | null {
  if (!isRecord(value) || !isRecord(value['customer']) || !Array.isArray(value['order_items']))
    return null
  const customer = value['customer']
  const orderStatus = value['order_status']
  const paymentStatus = value['payment_status']
  const fulfillmentStatus = value['fulfillment_status']
  const reportedAmount = value['payment_reported_amount_cents'] ?? null
  const reportedCurrency = value['payment_reported_currency'] ?? null
  const paymentPaidAt = value['payment_paid_at'] ?? null
  const paymentNote = value['payment_note'] ?? null
  const amountMatches = value['payment_amount_matches'] ?? null
  const receiptAvailable = value['payment_receipt_available'] ?? false
  const validOrderStatus = [
    'awaiting_payment',
    'confirmed',
    'inventory_exception',
    'cancelled',
  ].includes(String(orderStatus))
  const validPaymentStatus = ['pending', 'review', 'paid', 'rejected', 'cancelled'].includes(
    String(paymentStatus),
  )
  const validFulfillmentStatus = ['new', 'preparing', 'shipped', 'delivered', 'cancelled'].includes(
    String(fulfillmentStatus),
  )
  if (
    typeof value['id'] !== 'string' ||
    typeof value['code'] !== 'string' ||
    typeof value['created_at'] !== 'string' ||
    !Number.isSafeInteger(value['total_cents']) ||
    !validOrderStatus ||
    !validPaymentStatus ||
    !validFulfillmentStatus ||
    !['delivery_local', 'envio_nacional', 'retiro'].includes(String(value['delivery_method'])) ||
    !(value['shipping_agency'] === null || typeof value['shipping_agency'] === 'string') ||
    !(value['shipping_company'] === null || typeof value['shipping_company'] === 'string') ||
    !(
      value['shipping_tracking_number'] === null ||
      typeof value['shipping_tracking_number'] === 'string'
    ) ||
    !(value['shipping_notes'] === null || typeof value['shipping_notes'] === 'string') ||
    !(value['payment_reference'] === null || typeof value['payment_reference'] === 'string') ||
    !(reportedAmount === null || Number.isSafeInteger(reportedAmount)) ||
    !(reportedCurrency === null || reportedCurrency === 'VES' || reportedCurrency === 'USD') ||
    !(paymentPaidAt === null || typeof paymentPaidAt === 'string') ||
    !(paymentNote === null || typeof paymentNote === 'string') ||
    !(amountMatches === null || typeof amountMatches === 'boolean') ||
    typeof receiptAvailable !== 'boolean' ||
    typeof customer['firstName'] !== 'string' ||
    typeof customer['lastName'] !== 'string' ||
    typeof customer['phone'] !== 'string'
  )
    return null
  const items: RemoteAdminOrder['items'][number][] = []
  for (const rawItem of value['order_items']) {
    if (
      !isRecord(rawItem) ||
      typeof rawItem['product_name'] !== 'string' ||
      typeof rawItem['size'] !== 'string' ||
      typeof rawItem['color'] !== 'string' ||
      !Number.isSafeInteger(rawItem['quantity'])
    )
      return null
    items.push({
      productName: rawItem['product_name'],
      size: rawItem['size'],
      color: rawItem['color'],
      quantity: rawItem['quantity'] as number,
    })
  }
  return {
    id: value['id'],
    code: value['code'],
    createdAt: value['created_at'],
    customer: {
      firstName: customer['firstName'],
      lastName: customer['lastName'],
      phone: customer['phone'],
    },
    deliveryMethod: value['delivery_method'] as RemoteAdminOrder['deliveryMethod'],
    shippingAgency: value['shipping_agency'],
    shippingCompany: value['shipping_company'],
    shippingTrackingNumber: value['shipping_tracking_number'],
    shippingNotes: value['shipping_notes'],
    totalCents: value['total_cents'] as number,
    paymentReference: value['payment_reference'],
    paymentReportedAmountCents: typeof reportedAmount === 'number' ? reportedAmount : null,
    paymentReportedCurrency: reportedCurrency,
    paymentPaidAt,
    paymentNote,
    paymentAmountMatches: amountMatches,
    paymentReceiptAvailable: receiptAvailable,
    orderStatus: orderStatus as RemoteAdminOrder['orderStatus'],
    paymentStatus: paymentStatus as RemoteAdminOrder['paymentStatus'],
    fulfillmentStatus: fulfillmentStatus as RemoteAdminOrder['fulfillmentStatus'],
    items,
  }
}

export function parseRemoteCatalog(value: unknown): Catalog | null {
  if (!isRecord(value)) return null
  if (
    !Array.isArray(value['categories']) ||
    !Array.isArray(value['products']) ||
    !Array.isArray(value['variants'])
  )
    return null
  const categories: readonly unknown[] = value['categories']
  const products: readonly unknown[] = value['products']
  const variants: readonly unknown[] = value['variants']
  const catalog = parseCatalog({
    categories: categories.map((raw) => {
      if (!isRecord(raw)) return raw
      return {
        id: raw['id'],
        slug: raw['slug'],
        name: raw['name'],
        description: raw['description'],
      }
    }),
    products: products.map((raw) => {
      if (!isRecord(raw)) return raw
      return {
        id: raw['id'],
        slug: raw['slug'],
        name: raw['name'],
        categoryId: raw['category_id'],
        description: raw['description'],
        composition: raw['composition'],
        care: raw['care'],
        priceCents: raw['price_cents'],
        imageUrl: raw['image_url'],
        imageAlt: raw['image_alt'],
        active: raw['active'],
        createdAt: raw['created_at'],
      }
    }),
    variants: variants.map((raw) => {
      if (!isRecord(raw)) return raw
      return {
        id: raw['id'],
        productId: raw['product_id'],
        size: raw['size'],
        color: raw['color'],
        sku: raw['sku'],
        stock: raw['stock'],
      }
    }),
  })
  return catalog
}

function toUnknownArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : []
}

function parseRemoteInventoryMovement(value: unknown): InventoryMovement | null {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    !(value['variant_id'] === null || typeof value['variant_id'] === 'string') ||
    typeof value['sku'] !== 'string' ||
    typeof value['product_name'] !== 'string' ||
    !['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único'].includes(String(value['size'])) ||
    typeof value['color'] !== 'string' ||
    !Number.isSafeInteger(value['delta']) ||
    value['delta'] === 0 ||
    !['receipt', 'sale', 'adjustment', 'import'].includes(String(value['reason'])) ||
    !(value['note'] === null || typeof value['note'] === 'string') ||
    !(value['order_id'] === null || typeof value['order_id'] === 'string') ||
    typeof value['created_at'] !== 'string'
  ) {
    return null
  }
  return {
    id: value['id'],
    variantId: value['variant_id'],
    sku: value['sku'],
    productName: value['product_name'],
    size: value['size'] as InventoryMovement['size'],
    color: value['color'],
    delta: value['delta'] as number,
    reason: value['reason'] as InventoryMovement['reason'],
    note: value['note'],
    orderId: value['order_id'],
    createdAt: value['created_at'],
  }
}

function parseRemoteWhatsAppHandoff(value: unknown): RemoteWhatsAppHandoff | null {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    typeof value['sender_phone'] !== 'string' ||
    ![
      'human_requested',
      'payment_instructions_missing',
      'unknown_request',
      'payment_reference_submitted',
      'shipping_exception',
      'stock_exception',
    ].includes(String(value['reason'])) ||
    !['open', 'claimed', 'resolved'].includes(String(value['status'])) ||
    typeof value['created_at'] !== 'string' ||
    !(value['order_code'] === null || typeof value['order_code'] === 'string')
  ) {
    return null
  }
  return {
    id: value['id'],
    senderPhone: value['sender_phone'],
    orderCode: value['order_code'],
    reason: value['reason'] as RemoteWhatsAppHandoff['reason'],
    status: value['status'] as RemoteWhatsAppHandoff['status'],
    createdAt: value['created_at'],
  }
}

export async function updateRemoteAdminOrder(change: {
  readonly orderId: string
  readonly action: 'payment' | 'fulfillment' | 'shipping' | 'resolve_inventory'
  readonly status?: string
  readonly note?: string
  readonly shippingCompany?: string
  readonly shippingTrackingNumber?: string
  readonly shippingNotes?: string
}): Promise<unknown> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase todavía no está configurado.')
  const response = await client.functions.invoke<unknown>('admin-update-order', { body: change })
  if (response.error) throw new Error('No se pudo guardar el cambio autorizado.')
  const data: unknown = response.data
  return data
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function describeFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = isRecord(error) ? error['context'] : null
  if (context instanceof Response) {
    const body: unknown = await context
      .clone()
      .json()
      .catch(() => null)
    if (isRecord(body) && typeof body['error'] === 'string' && body['error'].trim()) {
      return `${body['error']} (HTTP ${String(context.status)}).`
    }
    return `${fallback} (HTTP ${String(context.status)}).`
  }
  return fallback
}

function parseSafeInteger(value: unknown): number | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : null
  }
  return null
}

function hasNonNegativeSafeIntegers<K extends string>(
  values: Record<K, number | null>,
): values is Record<K, number> {
  return Object.values(values).every(
    (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0,
  )
}

function parseReceipt(value: Record<string, unknown>): RemoteOrderReceipt | null {
  const stringFields = ['id', 'code', 'createdAt', 'vesPerUsd'] as const
  if (stringFields.some((field) => typeof value[field] !== 'string')) return null
  const numberFields = ['subtotalCents', 'shippingCents', 'totalCents', 'vesTotalCents'] as const
  if (numberFields.some((field) => !Number.isSafeInteger(value[field]))) return null
  return {
    id: value['id'] as string,
    code: value['code'] as string,
    createdAt: value['createdAt'] as string,
    subtotalCents: value['subtotalCents'] as number,
    shippingCents: value['shippingCents'] as number,
    totalCents: value['totalCents'] as number,
    vesPerUsd: value['vesPerUsd'] as string,
    vesTotalCents: value['vesTotalCents'] as number,
  }
}

function parseRemoteQuoteItems(value: unknown): RemoteCheckoutQuote['items'] | null {
  if (!Array.isArray(value)) return null
  const items: RemoteCheckoutQuote['items'][number][] = []
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item['variantId'] !== 'string' ||
      typeof item['productName'] !== 'string' ||
      typeof item['size'] !== 'string' ||
      !['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único'].includes(item['size']) ||
      typeof item['color'] !== 'string' ||
      typeof item['sku'] !== 'string' ||
      !Number.isSafeInteger(item['quantity']) ||
      !Number.isSafeInteger(item['unitPriceCents']) ||
      !Number.isSafeInteger(item['lineTotalCents']) ||
      !Number.isSafeInteger(item['stockAvailable'])
    ) {
      return null
    }
    items.push({
      variantId: item['variantId'],
      productName: item['productName'],
      size: item['size'] as Size,
      color: item['color'],
      sku: item['sku'],
      quantity: item['quantity'] as number,
      unitPriceCents: item['unitPriceCents'] as number,
      lineTotalCents: item['lineTotalCents'] as number,
      stockAvailable: item['stockAvailable'] as number,
    })
  }
  return items
}

export function parseRemotePublicOrder(value: unknown): Order | null {
  if (!isRecord(value) || !isRecord(value['customer']) || !Array.isArray(value['items']))
    return null
  const paymentMap = {
    pending: 'pendiente',
    review: 'por_verificar',
    paid: 'pagado',
    rejected: 'rechazado',
    cancelled: 'cancelado',
  } as const
  const fulfillmentMap = {
    new: 'nuevo',
    preparing: 'preparando',
    shipped: 'despachado',
    delivered: 'entregado',
    cancelled: 'cancelado',
  } as const
  const paymentStatus = mapPaymentStatus(value['paymentStatus'], paymentMap)
  const fulfillmentStatus = mapFulfillmentStatus(value['fulfillmentStatus'], fulfillmentMap)
  const orderStatus = value['orderStatus']
  const customer = value['customer']
  const paymentMethod = value['paymentMethod']
  const deliveryMethod = value['deliveryMethod']
  const address = value['shippingAddress']
  const quote = value['exchangeQuote']
  if (
    typeof value['id'] !== 'string' ||
    typeof value['code'] !== 'string' ||
    typeof value['createdAt'] !== 'string' ||
    typeof customer['firstName'] !== 'string' ||
    typeof customer['lastName'] !== 'string' ||
    typeof customer['phone'] !== 'string' ||
    !(customer['email'] === null || typeof customer['email'] === 'string') ||
    !['awaiting_payment', 'confirmed', 'inventory_exception', 'cancelled'].includes(
      String(orderStatus),
    ) ||
    !paymentStatus ||
    !fulfillmentStatus ||
    !['pago_movil', 'transferencia', 'efectivo', 'efectivo_ves', 'efectivo_usd'].includes(
      String(paymentMethod),
    ) ||
    !(value['paymentInstructions'] === null || typeof value['paymentInstructions'] === 'string') ||
    !(
      value['paymentReference'] === undefined ||
      value['paymentReference'] === null ||
      typeof value['paymentReference'] === 'string'
    ) ||
    !['delivery_local', 'envio_nacional', 'retiro'].includes(String(deliveryMethod)) ||
    !(address === null || isRecord(address)) ||
    !isRecord(quote) ||
    typeof quote['vesPerUsd'] !== 'string' ||
    (quote['source'] !== 'demo_ficticia' && quote['source'] !== 'bcv') ||
    typeof quote['quotedAt'] !== 'string' ||
    typeof quote['expiresAt'] !== 'string'
  ) {
    return null
  }
  const items = value['items'].map((item): unknown => {
    if (!isRecord(item)) return null
    return {
      productId: item['productId'],
      variantId: item['variantId'],
      productName: item['productName'],
      size: item['size'],
      color: item['color'],
      unitPriceCents: item['unitPriceCents'],
      quantity: item['quantity'],
    }
  })
  const histories: unknown[] = []
  if (Array.isArray(value['history'])) {
    for (const event of value['history']) {
      if (!isRecord(event)) return null
      let to = event['to']
      let from = event['from']
      if (event['axis'] === 'payment') {
        const mappedTo = mapPaymentStatus(to, paymentMap)
        const mappedFrom = from === null ? null : mapPaymentStatus(from, paymentMap)
        if (!mappedTo || (from !== null && !mappedFrom)) return null
        to = mappedTo
        from = mappedFrom
      } else if (event['axis'] === 'fulfillment') {
        const mappedTo = mapFulfillmentStatus(to, fulfillmentMap)
        const mappedFrom = from === null ? null : mapFulfillmentStatus(from, fulfillmentMap)
        if (!mappedTo || (from !== null && !mappedFrom)) return null
        to = mappedTo
        from = mappedFrom
      }
      histories.push({ ...event, to, from })
    }
  }
  const candidate = {
    id: value['id'],
    code: value['code'],
    createdAt: value['createdAt'],
    customer,
    deliveryMethod,
    shippingAddress: address,
    shippingAgency: value['shippingAgency'],
    shippingCompany: typeof value['shippingCompany'] === 'string' ? value['shippingCompany'] : null,
    shippingTrackingNumber:
      typeof value['shippingTrackingNumber'] === 'string' ? value['shippingTrackingNumber'] : null,
    shippingNotes: typeof value['shippingNotes'] === 'string' ? value['shippingNotes'] : null,
    paymentMethod,
    paymentInstructions: value['paymentInstructions'],
    paymentReference:
      typeof value['paymentReference'] === 'string' ? value['paymentReference'] : null,
    customerNote: value['customerNote'],
    items,
    subtotalCents: value['subtotalCents'],
    shippingCents: value['shippingCents'],
    totalCents: value['totalCents'],
    exchangeQuote: {
      vesPerUsd: quote['vesPerUsd'],
      source: quote['source'],
      quotedAt: quote['quotedAt'],
      expiresAt: quote['expiresAt'],
      ...(typeof quote['effectiveDate'] === 'string'
        ? { effectiveDate: quote['effectiveDate'] }
        : {}),
      ...(typeof quote['sourceUrl'] === 'string' ? { sourceUrl: quote['sourceUrl'] } : {}),
      ...(typeof quote['retrievedAt'] === 'string' ? { retrievedAt: quote['retrievedAt'] } : {}),
    },
    orderStatus,
    paymentStatus,
    fulfillmentStatus,
    notes: [],
    history: histories,
  }
  return parseOrders([candidate])?.[0] ?? null
}

export function parseRemoteStorePaymentOption(value: unknown): RemoteStorePaymentOption | null {
  if (
    !isRecord(value) ||
    !['pago_movil', 'transferencia', 'efectivo_ves', 'efectivo_usd'].includes(
      String(value['method']),
    ) ||
    typeof value['label'] !== 'string' ||
    typeof value['instructions'] !== 'string'
  ) {
    return null
  }
  return {
    method: value['method'] as RemoteStorePaymentOption['method'],
    label: value['label'],
    instructions: value['instructions'],
  }
}

export function parseRemoteAdminPaymentMethod(value: unknown): RemoteAdminPaymentMethod | null {
  if (
    !isRecord(value) ||
    ![
      'pago_movil',
      'transferencia',
      'efectivo_ves',
      'efectivo_usd',
      'paypal',
      'binance_pay',
      'card',
    ].includes(String(value['method'])) ||
    typeof value['label'] !== 'string' ||
    (value['kind'] !== 'manual' && value['kind'] !== 'provider') ||
    typeof value['active'] !== 'boolean' ||
    !(
      typeof value['public_instructions'] === 'string' || typeof value['instructions'] === 'string'
    ) ||
    !(typeof value['provider_ready'] === 'boolean' || typeof value['providerReady'] === 'boolean')
  ) {
    return null
  }
  return {
    method: value['method'] as ConfigurablePaymentMethod,
    label: value['label'],
    kind: value['kind'],
    active: value['active'],
    instructions:
      typeof value['public_instructions'] === 'string'
        ? value['public_instructions']
        : (value['instructions'] as string),
    providerReady:
      typeof value['provider_ready'] === 'boolean'
        ? value['provider_ready']
        : (value['providerReady'] as boolean),
  }
}

function mapPaymentStatus(
  value: unknown,
  values: Readonly<
    Record<string, 'pendiente' | 'por_verificar' | 'pagado' | 'rechazado' | 'cancelado'>
  >,
): 'pendiente' | 'por_verificar' | 'pagado' | 'rechazado' | 'cancelado' | null {
  return typeof value === 'string' && Object.hasOwn(values, value) ? (values[value] ?? null) : null
}

function mapFulfillmentStatus(
  value: unknown,
  values: Readonly<
    Record<string, 'nuevo' | 'preparando' | 'despachado' | 'entregado' | 'cancelado'>
  >,
): 'nuevo' | 'preparando' | 'despachado' | 'entregado' | 'cancelado' | null {
  return typeof value === 'string' && Object.hasOwn(values, value) ? (values[value] ?? null) : null
}
