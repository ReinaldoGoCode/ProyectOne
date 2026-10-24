import { getServiceClient, json, sha256Hex } from '../_shared/http.ts'
import {
  EMPTY_WHATSAPP_CONVERSATION_STATE,
  analyzeWhatsAppMessage,
  composeWhatsAppReply,
  parseWhatsAppConversationState,
} from '../../../src/lib/whatsappAssistant.ts'
import type {
  WhatsAppCatalogProductFact,
  WhatsAppDeliveryOptionFact,
  WhatsAppOrderSummaryFact,
  WhatsAppPaymentOptionFact,
} from '../../../src/lib/whatsappAssistant.ts'
import { requestWhatsAppIntentHint } from '../../../src/lib/whatsappAiIntent.ts'
import {
  sendWhatsAppSessionText,
  type WhatsAppCloudConfig,
} from '../../../src/lib/whatsappCloudApi.ts'
import { routeWhatsAppPurchaseContext } from '../../../src/lib/whatsappBot.ts'
import type { WhatsAppPurchaseContextFacts } from '../../../src/lib/whatsappBot.ts'
import {
  deduplicateWhatsAppEvents,
  extractWhatsAppEvents,
  extractWhatsAppInboundMessages,
  hashWhatsAppPhone,
  verifyWhatsAppWebhookSignature,
} from '../../../src/lib/whatsappWebhook.ts'

const MAX_WEBHOOK_BYTES = 1_000_000
const PURCHASE_REFERENCE = /\bNM-C-([0-9a-f]{64})\b/i
const GRAPH_VERSION = /^v[0-9]{1,3}\.0$/
const ORDER_TEMPLATE_NAME = /^[a-z0-9_]{1,128}$/
const ORDER_TEMPLATE_LANGUAGE = /^[a-z]{2}(?:_[A-Z]{2})?$/

Deno.serve(async (request) => {
  if (request.method === 'GET') return verifyHandshake(request)
  if (request.method === 'OPTIONS') return new Response('ok', { status: 204 })
  if (request.method !== 'POST') return json(request, 405, { error: 'Method not allowed.' })

  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')
  if (!appSecret) return json(request, 503, { error: 'WhatsApp webhook is not configured.' })
  const rawBody = await readBoundedBody(request, MAX_WEBHOOK_BYTES)
  if (rawBody === null) return json(request, 413, { error: 'Webhook payload is too large.' })
  const signature = request.headers.get('x-hub-signature-256') ?? ''
  if (
    !(await verifyWhatsAppWebhookSignature(new Uint8Array(rawBody).buffer, appSecret, signature))
  ) {
    return json(request, 401, { error: 'Invalid webhook signature.' })
  }

  let payload: unknown
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody))
  } catch {
    return json(request, 400, { error: 'Invalid webhook payload.' })
  }
  const extractedEvents = extractWhatsAppEvents(payload)
  const events = deduplicateWhatsAppEvents(extractedEvents)
  const messages = extractWhatsAppInboundMessages(payload)
  if (events.length === 0) {
    return json(request, 200, {
      received: true,
      recorded: 0,
      duplicates: extractedEvents.length,
    })
  }

  let service
  try {
    service = getServiceClient()
  } catch {
    return json(request, 503, { error: 'WhatsApp backend is not configured.' })
  }

  let recorded = 0
  let duplicates = extractedEvents.length - events.length
  let repliesQueued = 0
  let repliesSent = 0
  let handoffs = 0
  let deliveryStatuses = 0
  const messageByEventId = new Map(messages.map((message) => [message.id, message]))

  for (const event of events) {
    const { data: claimed, error: claimError } = await service.rpc('claim_whatsapp_webhook_event', {
      p_provider_event_id: event.id,
      p_event_type: event.type,
    })
    if (claimError) {
      console.error('whatsapp-webhook event claim failed', {
        code: claimError.code,
        type: event.type,
      })
      return json(request, 503, { error: 'Webhook event could not be claimed.' })
    }
    if (claimed !== true) {
      duplicates += 1
      continue
    }
    recorded += 1

    try {
      const message = event.type === 'incoming_message' ? messageByEventId.get(event.id) : undefined
      if (message) {
        const result = await handleInboundMessage(service, message)
        repliesQueued += result.replyQueued ? 1 : 0
        repliesSent += result.replySent ? 1 : 0
        handoffs += result.handoffCreated ? 1 : 0
      } else if (
        event.providerMessageId &&
        event.status &&
        ['sent', 'delivered', 'read', 'failed'].includes(event.status)
      ) {
        const { error: receiptError } = await service.rpc('record_whatsapp_delivery_status', {
          p_provider_message_id: event.providerMessageId,
          p_status: event.status,
          p_event_at: event.timestamp ?? new Date().toISOString(),
          p_error_code: event.errorCode ?? null,
        })
        if (receiptError) throw new Error('delivery_status_save_failed')
        deliveryStatuses += 1
      }
      const { error: completeError } = await service.rpc('complete_whatsapp_webhook_event', {
        p_provider_event_id: event.id,
      })
      if (completeError) throw new Error('event_complete_failed')
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : 'processing_failed'
      await service.rpc('fail_whatsapp_webhook_event', {
        p_provider_event_id: event.id,
        p_error_code: errorCode,
      })
      console.error('whatsapp-webhook message processing failed', {
        type: event.type,
        code: errorCode,
      })
      return json(request, 503, { error: 'Webhook event could not be processed.' })
    }
  }

  return json(request, 200, {
    received: true,
    recorded,
    duplicates,
    repliesQueued,
    repliesSent,
    handoffs,
    deliveryStatuses,
  })
})

async function handleInboundMessage(
  service: ReturnType<typeof getServiceClient>,
  inbound: ReturnType<typeof extractWhatsAppInboundMessages>[number],
): Promise<{ replyQueued: boolean; replySent: boolean; handoffCreated: boolean }> {
  const sender = inbound.from.replace(/\D/g, '')
  if (!/^[0-9]{8,15}$/.test(sender)) return emptyResult()
  const phoneHashSecret = Deno.env.get('WHATSAPP_PHONE_HASH_SECRET') ?? ''
  if (phoneHashSecret.length < 32) throw new Error('phone_hash_not_configured')
  const senderHash = await hashWhatsAppPhone(sender, phoneHashSecret)
  const inboundTime = inbound.timestamp ? Date.parse(inbound.timestamp) : Date.now()
  if (
    !Number.isFinite(inboundTime) ||
    inboundTime > Date.now() + 5 * 60 * 1000 ||
    inboundTime < Date.now() - 7 * 24 * 60 * 60 * 1000
  ) {
    return emptyResult()
  }
  const receivedAt = inbound.timestamp ?? new Date().toISOString()
  const windowExpiresAt = inbound.timestamp
    ? new Date(Date.parse(inbound.timestamp) + 24 * 60 * 60 * 1000).toISOString()
    : null

  const { data: optedOut, error: optOutError } = await service.rpc('is_whatsapp_opted_out', {
    p_sender_hash: senderHash,
  })
  if (optOutError) throw new Error('opt_out_lookup_failed')
  if (optedOut === true) return emptyResult()

  const { data: rawState, error: stateError } = await service.rpc('get_whatsapp_conversation', {
    p_sender_hash: senderHash,
  })
  if (stateError) throw new Error('conversation_lookup_failed')
  const state = parseWhatsAppConversationState(rawState ?? EMPTY_WHATSAPP_CONVERSATION_STATE)
  const normalizedText =
    inbound.text.trim() || (inbound.type === 'image' ? 'Ya envié el comprobante' : '')
  const localAnalysis = analyzeWhatsAppMessage({
    text: normalizedText,
    state,
    products: [],
  })

  if (localAnalysis.intent === 'opt_out') {
    const { error } = await service.rpc('record_whatsapp_opt_out', {
      p_sender_hash: senderHash,
      p_provider_event_id: inbound.id,
    })
    if (error) throw new Error('opt_out_record_failed')
    return emptyResult()
  }

  const { data: activeHandoff, error: handoffStateError } = await service.rpc(
    'is_whatsapp_handoff_active',
    { p_sender_phone: sender },
  )
  if (handoffStateError) throw new Error('handoff_state_lookup_failed')
  if (activeHandoff === true) return emptyResult()

  const purchaseToken = PURCHASE_REFERENCE.exec(normalizedText)?.[1]?.toLowerCase()
  if (purchaseToken) {
    const { data, error } = await service.rpc('claim_whatsapp_purchase_context', {
      p_token_hash: await sha256Hex(purchaseToken),
      p_sender_phone: sender,
    })
    if (error) throw new Error('purchase_context_claim_failed')
    const context = parsePurchaseContextFacts(data)
    const productUrl = context ? buildProductPageUrl(context) : null
    const reply = routeWhatsAppPurchaseContext(
      context ? { ...context, ...(productUrl ? { productUrl } : {}) } : null,
    )
    const nextState = context?.productSlug
      ? {
          ...state,
          productSlug: context.productSlug,
          size: context.size,
          color: context.color,
          quantity: context.quantity,
        }
      : state
    await saveConversation(service, senderHash, nextState, receivedAt)
    const handoffCreated = await createHandoffIfNeeded(
      service,
      inbound.id,
      sender,
      reply.referencedOrderCode,
      reply.handoffReason,
    )
    const sent = await enqueueAndDispatchReply(
      service,
      inbound.id,
      sender,
      senderHash,
      reply.message,
      windowExpiresAt,
    )
    return { replyQueued: sent.queued, replySent: sent.sent, handoffCreated }
  }

  const catalog = await loadCatalogFacts(service)
  const aiEligibleIntents = [
    'unknown',
    'product_question',
    'product_search',
    'product_recommendation',
    'product_comparison',
    'purchase_help',
  ]
  const aiMaxRequestsPerMinute = boundedEnvironmentInteger(
    'WHATSAPP_AI_MAX_REQUESTS_PER_MINUTE',
    8,
    8,
  )
  const aiMaxRequestsPerDay = boundedEnvironmentInteger(
    'WHATSAPP_AI_MAX_REQUESTS_PER_DAY',
    100,
    100,
  )
  const aiHint =
    inbound.type === 'text' && aiEligibleIntents.includes(localAnalysis.intent)
      ? await requestWhatsAppIntentHint({
          config: {
            enabled: Deno.env.get('WHATSAPP_AI_ENABLED') === 'true',
            freeTierConfirmed: Deno.env.get('WHATSAPP_AI_FREE_TIER_CONFIRMED') === 'true',
            privacyControlsConfirmed:
              Deno.env.get('WHATSAPP_AI_PRIVACY_CONTROLS_CONFIRMED') === 'true',
            provider: Deno.env.get('WHATSAPP_AI_PROVIDER') ?? undefined,
            apiKey: Deno.env.get('WHATSAPP_AI_API_KEY') ?? undefined,
            model: Deno.env.get('WHATSAPP_AI_MODEL') ?? undefined,
            maxCompletionTokens: boundedEnvironmentInteger(
              'WHATSAPP_AI_MAX_COMPLETION_TOKENS',
              128,
              256,
            ),
            maxInputChars: boundedEnvironmentInteger('WHATSAPP_AI_MAX_INPUT_CHARS', 400, 600),
          },
          hooks: {
            reserveRequest: async () => {
              const { data, error } = await service.rpc('reserve_whatsapp_ai_request', {
                p_max_per_minute: aiMaxRequestsPerMinute,
                p_max_per_day: aiMaxRequestsPerDay,
              })
              if (error) {
                console.warn('whatsapp-ai quota reservation unavailable', { code: error.code })
                return 'unavailable'
              }
              if (data === 'allowed') return 'allowed'
              if (data === 'minute_limit' || data === 'daily_limit') return 'limit_reached'
              return 'unavailable'
            },
            onEvent: (code) => console.warn('whatsapp-ai request skipped', { code }),
          },
          text: normalizedText,
        })
      : null
  const analysis = analyzeWhatsAppMessage({
    text: normalizedText,
    state,
    products: catalog,
    ...(aiHint ? { intentHint: aiHint } : {}),
  })

  if (analysis.intent === 'opt_out') {
    const { error } = await service.rpc('record_whatsapp_opt_out', {
      p_sender_hash: senderHash,
      p_provider_event_id: inbound.id,
    })
    if (error) throw new Error('opt_out_record_failed')
    return emptyResult()
  }

  let matchingOrders: WhatsAppOrderSummaryFact[] = []
  let order: WhatsAppOrderSummaryFact | null = null
  if (
    ['order_status', 'delivery_status', 'payment_help', 'payment_reference'].includes(
      analysis.intent,
    )
  ) {
    const { data, error } = await service.rpc('lookup_whatsapp_orders', {
      p_phone: sender,
      p_code: analysis.orderCode,
    })
    if (error) throw new Error('order_lookup_failed')
    matchingOrders = parseOrderFactsList(data)
    order = analysis.orderCode
      ? (matchingOrders.find((candidate) => candidate.code.toUpperCase() === analysis.orderCode) ??
        null)
      : matchingOrders.length === 1
        ? (matchingOrders[0] ?? null)
        : null
  }

  let paymentReferenceResult: 'submitted' | 'already_verified' | 'not_found' | null = null
  if (analysis.intent === 'payment_reference' && analysis.paymentReference && order) {
    const { data, error } = await service.rpc('submit_whatsapp_payment_reference', {
      p_phone: sender,
      p_order_code: order.code,
      p_reference: analysis.paymentReference,
    })
    if (error || !isRecord(data)) throw new Error('payment_reference_submission_failed')
    paymentReferenceResult =
      data['status'] === 'submitted' ||
      data['status'] === 'already_verified' ||
      data['status'] === 'not_found'
        ? data['status']
        : null
  }

  const paymentOptions =
    analysis.intent === 'payment_help' && !order ? await loadPaymentOptions(service) : []
  const deliveryOptions =
    analysis.intent === 'delivery_options' ? await loadDeliveryOptions(service) : []
  const reply = composeWhatsAppReply({
    analysis,
    products: catalog,
    order,
    matchingOrders,
    paymentOptions,
    deliveryOptions,
    paymentReferenceResult,
  })
  const nextState = {
    ...reply.nextState,
    ...(order ? { orderCode: order.code } : {}),
  }
  await saveConversation(service, senderHash, nextState, receivedAt)
  const handoffCreated = await createHandoffIfNeeded(
    service,
    inbound.id,
    sender,
    order?.code ?? analysis.orderCode,
    reply.handoffReason,
  )
  const sent = await enqueueAndDispatchReply(
    service,
    inbound.id,
    sender,
    senderHash,
    reply.message,
    windowExpiresAt,
  )
  return { replyQueued: sent.queued, replySent: sent.sent, handoffCreated }
}

async function saveConversation(
  service: ReturnType<typeof getServiceClient>,
  senderHash: string,
  state: unknown,
  lastInboundAt: string,
): Promise<void> {
  const { error } = await service.rpc('save_whatsapp_conversation', {
    p_sender_hash: senderHash,
    p_context: state,
    p_last_inbound_at: lastInboundAt,
  })
  if (error) throw new Error('conversation_save_failed')
}

async function createHandoffIfNeeded(
  service: ReturnType<typeof getServiceClient>,
  eventId: string,
  sender: string,
  orderCode: string | null,
  reason:
    | 'human_requested'
    | 'payment_instructions_missing'
    | 'unknown_request'
    | 'payment_reference_submitted'
    | 'shipping_exception'
    | 'stock_exception'
    | null,
): Promise<boolean> {
  if (!reason) return false
  const { data, error } = await service.rpc('create_whatsapp_handoff', {
    p_provider_event_id: eventId,
    p_sender_phone: sender,
    p_order_code: orderCode,
    p_reason: reason,
  })
  if (error) throw new Error('handoff_save_failed')
  return data === true
}

async function enqueueAndDispatchReply(
  service: ReturnType<typeof getServiceClient>,
  eventId: string,
  recipient: string,
  recipientHash: string,
  text: string,
  windowExpiresAt: string | null,
): Promise<{ queued: boolean; sent: boolean }> {
  if (Deno.env.get('WHATSAPP_SEND_ENABLED') !== 'true' || !text.trim() || !windowExpiresAt) {
    return { queued: false, sent: false }
  }
  if (Date.parse(windowExpiresAt) <= Date.now()) return { queued: false, sent: false }
  const { error: enqueueError } = await service.rpc('enqueue_whatsapp_reply', {
    p_provider_event_id: eventId,
    p_recipient_phone: recipient,
    p_recipient_hash: recipientHash,
    p_body: text.slice(0, 2000),
    p_window_expires_at: windowExpiresAt,
  })
  if (enqueueError) throw new Error('reply_queue_failed')
  const { data: queued, error: claimError } = await service.rpc('claim_whatsapp_reply', {
    p_provider_event_id: eventId,
  })
  if (claimError) throw new Error('reply_claim_failed')
  if (!isRecord(queued)) return { queued: true, sent: false }
  const apiConfig = getCloudConfig()
  const sendResult = await sendWhatsAppSessionText({
    config: apiConfig,
    recipient: String(queued['recipientPhone'] ?? ''),
    text: String(queued['body'] ?? ''),
    windowExpiresAt: String(queued['windowExpiresAt'] ?? ''),
  })
  const { error: finishError } = await service.rpc('finish_whatsapp_reply', {
    p_provider_event_id: eventId,
    p_status: sendResult.sent ? 'sent' : 'failed',
    p_provider_message_id: sendResult.providerMessageId,
    p_error_code: sendResult.errorCode,
  })
  if (finishError) throw new Error('reply_status_save_failed')
  if (!sendResult.sent) {
    console.error('whatsapp-webhook send failed', { code: sendResult.errorCode ?? 'unknown' })
  }
  return { queued: true, sent: sendResult.sent }
}

async function loadCatalogFacts(
  service: ReturnType<typeof getServiceClient>,
): Promise<WhatsAppCatalogProductFact[]> {
  const [productsResult, categoriesResult, variantsResult] = await Promise.all([
    service
      .from('products')
      .select('id,slug,name,category_id,description,composition,price_cents,active,created_at')
      .eq('active', true)
      .order('name')
      .limit(500),
    service.from('categories').select('id,name').limit(100),
    service.from('variants').select('id,product_id,size,color,stock').limit(5000),
  ])
  if (productsResult.error || categoriesResult.error || variantsResult.error) {
    throw new Error('catalog_lookup_failed')
  }
  const categoryNames = new Map<string, string>()
  for (const row of toRecordArray(categoriesResult.data)) {
    if (typeof row['id'] === 'string' && typeof row['name'] === 'string') {
      categoryNames.set(row['id'], row['name'])
    }
  }
  const variantsByProduct = new Map<string, WhatsAppCatalogProductFact['variants'][number][]>()
  for (const row of toRecordArray(variantsResult.data)) {
    if (
      typeof row['product_id'] !== 'string' ||
      typeof row['id'] !== 'string' ||
      typeof row['size'] !== 'string' ||
      typeof row['color'] !== 'string' ||
      !Number.isSafeInteger(row['stock']) ||
      (row['stock'] as number) < 0
    ) {
      continue
    }
    const variants = variantsByProduct.get(row['product_id']) ?? []
    variants.push({
      id: row['id'],
      size: row['size'],
      color: row['color'],
      stock: row['stock'] as number,
    })
    variantsByProduct.set(row['product_id'], variants)
  }
  const products: WhatsAppCatalogProductFact[] = []
  for (const row of toRecordArray(productsResult.data)) {
    if (
      typeof row['id'] !== 'string' ||
      typeof row['slug'] !== 'string' ||
      typeof row['name'] !== 'string' ||
      typeof row['category_id'] !== 'string' ||
      typeof row['description'] !== 'string' ||
      typeof row['composition'] !== 'string' ||
      !Number.isSafeInteger(row['price_cents']) ||
      (row['price_cents'] as number) <= 0
    ) {
      continue
    }
    products.push({
      slug: row['slug'],
      name: row['name'],
      category: categoryNames.get(row['category_id']) ?? 'Otros',
      description: row['description'],
      composition: row['composition'],
      priceCents: row['price_cents'] as number,
      variants: variantsByProduct.get(row['id']) ?? [],
    })
  }
  return products
}

async function loadPaymentOptions(
  service: ReturnType<typeof getServiceClient>,
): Promise<WhatsAppPaymentOptionFact[]> {
  const { data, error } = await service
    .from('payment_methods')
    .select('method,label,public_instructions')
    .eq('kind', 'manual')
    .eq('active', true)
    .limit(4)
  if (error) throw new Error('payment_settings_lookup_failed')
  return toRecordArray(data)
    .filter(
      (row) =>
        typeof row['method'] === 'string' &&
        typeof row['label'] === 'string' &&
        typeof row['public_instructions'] === 'string',
    )
    .map((row) => ({
      method: row['method'] as string,
      label: row['label'] as string,
      instructions: row['public_instructions'] as string,
    }))
}

async function loadDeliveryOptions(
  service: ReturnType<typeof getServiceClient>,
): Promise<WhatsAppDeliveryOptionFact[]> {
  const { data, error } = await service
    .from('shipping_rates')
    .select('delivery_method,amount_cents,demo_only')
    .limit(3)
  if (error) throw new Error('shipping_settings_lookup_failed')
  return toRecordArray(data)
    .filter(isDeliveryOption)
    .map((row) => ({
      method: row['delivery_method'] as WhatsAppDeliveryOptionFact['method'],
      amountCents: row['amount_cents'] as number,
      demoOnly: row['demo_only'] as boolean,
    }))
}

function isDeliveryOption(value: Record<string, unknown>): boolean {
  return (
    ['delivery_local', 'envio_nacional', 'retiro'].includes(String(value['delivery_method'])) &&
    Number.isSafeInteger(value['amount_cents']) &&
    (value['amount_cents'] as number) >= 0 &&
    typeof value['demo_only'] === 'boolean'
  )
}

function parseOrderFactsList(value: unknown): WhatsAppOrderSummaryFact[] {
  if (!Array.isArray(value)) return []
  return value
    .map(parseOrderFacts)
    .filter((order): order is WhatsAppOrderSummaryFact => order !== null)
}

function parseOrderFacts(value: unknown): WhatsAppOrderSummaryFact | null {
  if (!isRecord(value)) return null
  if (
    typeof value['code'] !== 'string' ||
    !['pending', 'review', 'paid', 'rejected', 'cancelled'].includes(
      String(value['paymentStatus']),
    ) ||
    !['awaiting_payment', 'confirmed', 'inventory_exception', 'cancelled'].includes(
      String(value['orderStatus']),
    ) ||
    !['new', 'preparing', 'shipped', 'delivered', 'cancelled'].includes(
      String(value['fulfillmentStatus']),
    ) ||
    !Number.isSafeInteger(value['totalCents']) ||
    !Number.isSafeInteger(value['vesTotalCents']) ||
    typeof value['vesPerUsd'] !== 'string' ||
    (value['paymentInstructions'] !== null && typeof value['paymentInstructions'] !== 'string') ||
    (value['exchangeSource'] !== 'demo_ficticia' && value['exchangeSource'] !== 'bcv') ||
    (value['deliveryMethod'] !== null &&
      !['delivery_local', 'envio_nacional', 'retiro'].includes(String(value['deliveryMethod']))) ||
    (value['shippingAgency'] !== null && typeof value['shippingAgency'] !== 'string') ||
    (value['shippingCompany'] !== null && typeof value['shippingCompany'] !== 'string') ||
    (value['shippingTrackingNumber'] !== null &&
      typeof value['shippingTrackingNumber'] !== 'string') ||
    (value['shippingNotes'] !== null && typeof value['shippingNotes'] !== 'string') ||
    !Number.isSafeInteger(value['shippingCents']) ||
    typeof value['paymentMethod'] !== 'string'
  ) {
    return null
  }
  return {
    code: value['code'],
    paymentStatus: value['paymentStatus'] as WhatsAppOrderSummaryFact['paymentStatus'],
    orderStatus: value['orderStatus'] as WhatsAppOrderSummaryFact['orderStatus'],
    fulfillmentStatus: value['fulfillmentStatus'] as WhatsAppOrderSummaryFact['fulfillmentStatus'],
    totalCents: value['totalCents'] as number,
    vesTotalCents: value['vesTotalCents'] as number,
    vesPerUsd: value['vesPerUsd'],
    exchangeSource: value['exchangeSource'],
    paymentInstructions: value['paymentInstructions'] as string | null,
    paymentMethod: value['paymentMethod'],
    deliveryMethod: value['deliveryMethod'] as WhatsAppOrderSummaryFact['deliveryMethod'],
    shippingAgency: value['shippingAgency'] as string | null,
    shippingCompany: value['shippingCompany'] as string | null,
    shippingTrackingNumber: value['shippingTrackingNumber'] as string | null,
    shippingNotes: value['shippingNotes'] as string | null,
    shippingCents: value['shippingCents'] as number,
  }
}

function parsePurchaseContextFacts(value: unknown): WhatsAppPurchaseContextFacts | null {
  if (!isRecord(value) || (value['status'] !== 'available' && value['status'] !== 'unavailable')) {
    return null
  }
  const valid =
    typeof value['productName'] === 'string' &&
    value['productName'].length >= 1 &&
    value['productName'].length <= 200 &&
    typeof value['productSlug'] === 'string' &&
    value['productSlug'].length >= 1 &&
    value['productSlug'].length <= 100 &&
    typeof value['size'] === 'string' &&
    value['size'].length >= 1 &&
    value['size'].length <= 20 &&
    typeof value['color'] === 'string' &&
    value['color'].length >= 1 &&
    value['color'].length <= 100 &&
    Number.isSafeInteger(value['quantity']) &&
    (value['quantity'] as number) >= 1 &&
    (value['quantity'] as number) <= 10 &&
    Number.isSafeInteger(value['unitPriceCents']) &&
    (value['unitPriceCents'] as number) > 0 &&
    Number.isSafeInteger(value['stock']) &&
    (value['stock'] as number) >= 0 &&
    typeof value['available'] === 'boolean' &&
    value['available'] === (value['status'] === 'available')
  if (!valid) return null
  return {
    productSlug: value['productSlug'] as string,
    productName: value['productName'] as string,
    size: value['size'] as string,
    color: value['color'] as string,
    quantity: value['quantity'] as number,
    unitPriceCents: value['unitPriceCents'] as number,
    stock: value['stock'] as number,
    available: value['available'] as boolean,
  }
}

function getCloudConfig(): WhatsAppCloudConfig {
  const graphApiVersion = Deno.env.get('WHATSAPP_GRAPH_API_VERSION') ?? ''
  return {
    enabled: Deno.env.get('WHATSAPP_SEND_ENABLED') === 'true',
    accessToken: Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? undefined,
    phoneNumberId: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? undefined,
    graphApiVersion: GRAPH_VERSION.test(graphApiVersion) ? graphApiVersion : undefined,
  }
}

function buildProductPageUrl(
  context: WhatsAppPurchaseContextFacts & { readonly productSlug?: string },
): string | null {
  const configuredSite = Deno.env.get('PUBLIC_SITE_URL')?.trim() ?? ''
  if (
    !configuredSite ||
    !context.productSlug ||
    !/^[a-z0-9][a-z0-9-]{0,99}$/i.test(context.productSlug)
  ) {
    return null
  }
  try {
    const base = new URL(configuredSite)
    if (base.protocol !== 'https:' || base.username || base.password) return null
    base.search = ''
    base.hash = ''
    base.pathname = `${base.pathname.replace(/\/+$/, '')}/`
    const productUrl = new URL(`producto/${encodeURIComponent(context.productSlug)}`, base)
    productUrl.searchParams.set('talla', context.size)
    productUrl.searchParams.set('color', context.color)
    productUrl.searchParams.set('cantidad', String(context.quantity))
    return productUrl.toString()
  } catch {
    return null
  }
}

function verifyHandshake(request: Request): Response {
  const url = new URL(request.url)
  const token = Deno.env.get('WHATSAPP_VERIFY_TOKEN')
  const mode = url.searchParams.get('hub.mode')
  const receivedToken = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  if (token && mode === 'subscribe' && receivedToken === token && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  return new Response('Forbidden', { status: 403 })
}

async function readBoundedBody(request: Request, limit: number): Promise<Uint8Array | null> {
  const reader = request.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function boundedEnvironmentInteger(name: string, fallback: number, maximum: number): number {
  const configured = Number(Deno.env.get(name))
  return Number.isInteger(configured) ? Math.min(maximum, Math.max(1, configured)) : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function emptyResult(): { replyQueued: false; replySent: false; handoffCreated: false } {
  return { replyQueued: false, replySent: false, handoffCreated: false }
}
