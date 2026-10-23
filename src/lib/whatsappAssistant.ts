export type WhatsAppAssistantIntent =
  | 'greeting'
  | 'product_question'
  | 'product_search'
  | 'product_recommendation'
  | 'product_comparison'
  | 'purchase_help'
  | 'order_status'
  | 'payment_help'
  | 'payment_reference'
  | 'delivery_options'
  | 'delivery_status'
  | 'human_requested'
  | 'opt_out'
  | 'unknown'

export interface WhatsAppCatalogVariantFact {
  readonly id: string
  readonly size: string
  readonly color: string
  readonly stock: number
}

export interface WhatsAppCatalogProductFact {
  readonly slug: string
  readonly name: string
  readonly category: string
  readonly description: string
  readonly composition: string
  readonly priceCents: number
  readonly variants: readonly WhatsAppCatalogVariantFact[]
}

export interface WhatsAppConversationState {
  readonly productSlug: string | null
  readonly size: string | null
  readonly color: string | null
  readonly quantity: number | null
  readonly orderCode: string | null
  readonly preferenceCategory: string | null
  readonly preferenceSize: string | null
  readonly preferenceColor: string | null
  readonly awaitingPaymentReference: boolean
}

export const EMPTY_WHATSAPP_CONVERSATION_STATE: WhatsAppConversationState = {
  productSlug: null,
  size: null,
  color: null,
  quantity: null,
  orderCode: null,
  preferenceCategory: null,
  preferenceSize: null,
  preferenceColor: null,
  awaitingPaymentReference: false,
}

export interface WhatsAppIntentHint {
  readonly intent?:
    | 'greeting'
    | 'product_question'
    | 'product_search'
    | 'product_recommendation'
    | 'product_comparison'
    | 'purchase_help'
    | 'unknown'
  readonly searchQuery?: string
  readonly size?: string
  readonly color?: string
  readonly quantity?: number
}

export interface WhatsAppAnalysis {
  readonly intent: WhatsAppAssistantIntent
  readonly productSlug: string | null
  readonly matchedProductSlugs: readonly string[]
  readonly size: string | null
  readonly color: string | null
  readonly quantity: number | null
  readonly orderCode: string | null
  readonly paymentReference: string | null
  readonly nextState: WhatsAppConversationState
}

export interface WhatsAppPaymentOptionFact {
  readonly method: string
  readonly label: string
  readonly instructions: string
}

export interface WhatsAppOrderFacts {
  readonly code: string
  readonly paymentStatus: 'pending' | 'review' | 'paid' | 'rejected' | 'cancelled'
  readonly orderStatus: 'awaiting_payment' | 'confirmed' | 'inventory_exception' | 'cancelled'
  readonly fulfillmentStatus: 'new' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'
  readonly totalCents: number
  readonly vesTotalCents: number
  readonly vesPerUsd: string
  readonly exchangeSource: 'demo_ficticia' | 'bcv'
  readonly paymentInstructions?: string | null
}

export interface WhatsAppDeliveryOptionFact {
  readonly method: 'delivery_local' | 'envio_nacional' | 'retiro'
  readonly amountCents: number
  readonly demoOnly: boolean
}

export interface WhatsAppOrderSummaryFact extends WhatsAppOrderFacts {
  readonly deliveryMethod?: 'delivery_local' | 'envio_nacional' | 'retiro'
  readonly shippingAgency?: string | null
  readonly shippingCompany?: string | null
  readonly shippingTrackingNumber?: string | null
  readonly shippingNotes?: string | null
  readonly shippingCents?: number
  readonly paymentMethod?: string
}

export interface WhatsAppAssistantReply {
  readonly message: string
  readonly intent: WhatsAppAssistantIntent
  readonly nextState: WhatsAppConversationState
  readonly handoffReason:
    | 'human_requested'
    | 'payment_instructions_missing'
    | 'unknown_request'
    | 'payment_reference_submitted'
    | 'shipping_exception'
    | 'stock_exception'
    | null
  readonly optOut: boolean
  readonly submitPaymentReference: string | null
}

export interface ComposeWhatsAppReplyInput {
  readonly analysis: WhatsAppAnalysis
  readonly products: readonly WhatsAppCatalogProductFact[]
  readonly order: WhatsAppOrderSummaryFact | null
  readonly matchingOrders?: readonly WhatsAppOrderSummaryFact[]
  readonly paymentOptions?: readonly WhatsAppPaymentOptionFact[]
  readonly deliveryOptions?: readonly WhatsAppDeliveryOptionFact[]
  readonly paymentReferenceResult?: 'submitted' | 'already_verified' | 'not_found' | null
}

export function parseWhatsAppConversationState(value: unknown): WhatsAppConversationState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return EMPTY_WHATSAPP_CONVERSATION_STATE
  }
  const raw = value as Record<string, unknown>
  return {
    productSlug:
      typeof raw['productSlug'] === 'string' && raw['productSlug'].length <= 100
        ? raw['productSlug']
        : null,
    size: typeof raw['size'] === 'string' && raw['size'].length <= 20 ? raw['size'] : null,
    color: typeof raw['color'] === 'string' && raw['color'].length <= 60 ? raw['color'] : null,
    quantity:
      Number.isInteger(raw['quantity']) &&
      Number(raw['quantity']) >= 1 &&
      Number(raw['quantity']) <= 10
        ? Number(raw['quantity'])
        : null,
    orderCode:
      typeof raw['orderCode'] === 'string' && /^NM-\d{3,}$/i.test(raw['orderCode'])
        ? raw['orderCode'].toUpperCase()
        : null,
    preferenceCategory:
      typeof raw['preferenceCategory'] === 'string' && raw['preferenceCategory'].length <= 80
        ? raw['preferenceCategory']
        : null,
    preferenceSize:
      typeof raw['preferenceSize'] === 'string' && raw['preferenceSize'].length <= 20
        ? raw['preferenceSize']
        : null,
    preferenceColor:
      typeof raw['preferenceColor'] === 'string' && raw['preferenceColor'].length <= 60
        ? raw['preferenceColor']
        : null,
    awaitingPaymentReference: raw['awaitingPaymentReference'] === true,
  }
}

const ORDER_CODE = /\bNM-\d{3,}\b/i
const EXPLICIT_REFERENCE =
  /(?:referencia|ref\.?|numero de operacion|nro\.? de operacion)\s*[:#-]?\s*([a-z0-9-]{4,30})/i
const HUMAN_REQUEST =
  /\b(persona|humano|humana|asesor|asesora|agente|operador|operadora|representante)\b/i
const OPT_OUT =
  /\b(stop|basta|no\s+me\s+(?:escribas|contactes)|no\s+quiero\s+(?:mensajes|mas\s+mensajes)|cancelar\s+mensajes|dejar\s+de\s+recibir)\b/i
const ORDER_QUERY =
  /\b(pedido|orden|estado|seguimiento|rastreo|guia|envio|despachad|entrega|llego|llegara)\b/i
const PAYMENT_QUERY =
  /\b(pago|pagar|pague|pague|pagado|pago\s*m[oó]vil|transferencia|comprobante|referencia|banco|cuenta)\b/i
const DELIVERY_QUERY =
  /\b(envio|delivery|entrega|retiro|retirar|despacho|mrw|zoom|agencia|llega|llegada)\b/i
const COMPARE_QUERY = /\b(compar|diferencia|entre\s+.+\s+y\s+)\b/i
const RECOMMEND_QUERY =
  /\b(recomiend|suger|busco|necesito\s+algo|quiero\s+algo|que\s+me\s+recomiendas)\b/i
const PRODUCT_QUERY =
  /\b(precio|cuesta|cost|vale|talla|tallas|color|colores|stock|disponible|disponibilidad|tienen|hay|composicion|tela|comprar|compra|prenda|modelo)\b/i
const GREETING =
  /^(hola|buenas(?:\s+(?:tardes|dias|noches))?|buen dia|buenos dias|saludos|gracias|muchas gracias)[!.\s]*$/i
const CATEGORY_WORDS = [
  'vestido',
  'camisa',
  'blusa',
  'pantalon',
  'falda',
  'top',
  'chaqueta',
  'conjunto',
  'short',
  'jean',
]

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-VE')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function wordTokens(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 1 &&
        ![
          'que',
          'con',
          'para',
          'por',
          'una',
          'uno',
          'del',
          'las',
          'los',
          'tiene',
          'tienen',
          'hay',
          'como',
          'esta',
          'este',
          'mi',
          'va',
          'yo',
        ].includes(word),
    )
}

function editDistanceAtMostOne(left: string, right: string): boolean {
  if (left === right) return true
  if (Math.abs(left.length - right.length) > 1) return false
  let leftIndex = 0
  let rightIndex = 0
  let edits = 0
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1
      rightIndex += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (left.length > right.length) leftIndex += 1
    else if (right.length > left.length) rightIndex += 1
    else {
      leftIndex += 1
      rightIndex += 1
    }
  }
  if (leftIndex < left.length || rightIndex < right.length) edits += 1
  return edits <= 1
}

function scoreProduct(product: WhatsAppCatalogProductFact, query: string): number {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return 0
  const normalizedName = normalizeText(product.name)
  const normalizedCategory = normalizeText(product.category)
  if (normalizedName && normalizedQuery.includes(normalizedName)) return 20
  const queryTokens = wordTokens(query)
  const nameTokens = wordTokens(product.name)
  const categoryTokens = wordTokens(product.category)
  const descriptionTokens = wordTokens(product.description)
  let score = 0
  for (const token of queryTokens) {
    if (
      nameTokens.some(
        (name) => name === token || (token.length >= 4 && editDistanceAtMostOne(token, name)),
      )
    )
      score += 5
    else if (
      categoryTokens.some(
        (category) =>
          category === token || (token.length >= 4 && editDistanceAtMostOne(token, category)),
      ) ||
      (token.length >= 4 && normalizedCategory.includes(token))
    )
      score += 3
    else if (descriptionTokens.includes(token)) score += 1
  }
  return score
}

function topProductMatches(
  query: string,
  products: readonly WhatsAppCatalogProductFact[],
): WhatsAppCatalogProductFact[] {
  return products
    .map((product) => ({ product, score: scoreProduct(product, query) }))
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.product.name.localeCompare(right.product.name, 'es'),
    )
    .slice(0, 3)
    .map((item) => item.product)
}

function extractSize(text: string, products: readonly WhatsAppCatalogProductFact[]): string | null {
  const mentioned = /\btalla\s+(xs|xxl|xl|s|m|l|unico)\b/i.exec(text)?.[1]
  const standalone = /(?:^|\s)(xxl|xl|xs|m|l|s)(?:\s|$)/i.exec(text)?.[1]
  const value = mentioned ?? standalone
  if (!value) return null
  const canonical = value.toUpperCase() === 'UNICO' ? 'Único' : value.toUpperCase()
  return products.some((product) => product.variants.some((variant) => variant.size === canonical))
    ? canonical
    : null
}

function extractColor(
  text: string,
  products: readonly WhatsAppCatalogProductFact[],
): string | null {
  const normalized = normalizeText(text)
  const colors = [
    ...new Set(products.flatMap((product) => product.variants.map((variant) => variant.color))),
  ].sort((a, b) => b.length - a.length)
  return (
    colors.find((color) => {
      const normalizedColor = normalizeText(color)
      return normalizedColor.length > 1 && ` ${normalized} `.includes(` ${normalizedColor} `)
    }) ?? null
  )
}

function extractQuantity(text: string): number | null {
  const match =
    /\b(?:quiero|necesito|llevo|dame|comprar|compr[oó]|cantidad)?\s*(\d{1,2})\s*(?:unidades|unidad|uds|piezas|prendas)?\b/i.exec(
      text,
    )
  if (!match) return null
  const quantity = Number(match[1])
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 10 ? quantity : null
}

function validHint(hint: WhatsAppIntentHint | undefined): WhatsAppIntentHint {
  if (!hint) return {}
  const allowedIntents: readonly string[] = [
    'greeting',
    'product_question',
    'product_search',
    'product_recommendation',
    'product_comparison',
    'purchase_help',
    'unknown',
  ]
  return {
    ...(hint.intent && allowedIntents.includes(hint.intent) ? { intent: hint.intent } : {}),
    ...(typeof hint.searchQuery === 'string'
      ? { searchQuery: hint.searchQuery.slice(0, 100) }
      : {}),
    ...(typeof hint.size === 'string' ? { size: hint.size.slice(0, 20) } : {}),
    ...(typeof hint.color === 'string' ? { color: hint.color.slice(0, 60) } : {}),
    ...(Number.isInteger(hint.quantity) && Number(hint.quantity) >= 1 && Number(hint.quantity) <= 10
      ? { quantity: Number(hint.quantity) }
      : {}),
  }
}

export function analyzeWhatsAppMessage(input: {
  readonly text: string
  readonly state: WhatsAppConversationState
  readonly products: readonly WhatsAppCatalogProductFact[]
  readonly intentHint?: WhatsAppIntentHint
}): WhatsAppAnalysis {
  const text = input.text.trim().slice(0, 1500)
  const hint = validHint(input.intentHint)
  const rawOrderCode = ORDER_CODE.exec(text)?.[0] ?? input.state.orderCode
  const orderCode = rawOrderCode?.toUpperCase() ?? null
  const hintedQuery = hint.searchQuery?.trim() ?? ''
  const matches = topProductMatches(hintedQuery || text, input.products)
  const contextualProduct = input.products.find(
    (product) => product.slug === input.state.productSlug,
  )
  const product = matches[0] ?? contextualProduct ?? null
  const mentionedProduct = matches.length > 0
  const size =
    hint.size &&
    input.products.some((item) =>
      item.variants.some((variant) => variant.size.toLowerCase() === hint.size?.toLowerCase()),
    )
      ? hint.size
      : (extractSize(text, input.products) ?? input.state.preferenceSize ?? input.state.size)
  const color =
    hint.color &&
    input.products.some((item) =>
      item.variants.some(
        (variant) => normalizeText(variant.color) === normalizeText(hint.color ?? ''),
      ),
    )
      ? (input.products
          .flatMap((item) => item.variants.map((variant) => variant.color))
          .find((candidate) => normalizeText(candidate) === normalizeText(hint.color ?? '')) ??
        null)
      : (extractColor(text, input.products) ?? input.state.preferenceColor ?? input.state.color)
  const quantity = hint.quantity ?? extractQuantity(text) ?? input.state.quantity
  const explicitHuman = HUMAN_REQUEST.test(text)
  const optOut = OPT_OUT.test(normalizeText(text))
  const hasPaymentReference =
    input.state.awaitingPaymentReference ||
    /\b(referencia|ref\.?|comprobante|transferi|transfer[ií])\b/i.test(text)
  const paymentAlreadyMade =
    /\b(ya\s+(?:pague|pague|hice|realice|envie|mande)|hice\s+la\s+transferencia|transferi|transfer[ií]|mande\s+el\s+comprobante)\b/i.test(
      normalizeText(text),
    )
  const bareReference =
    input.state.awaitingPaymentReference && /^[A-Z0-9-]{4,30}$/i.test(text.trim())
      ? text.trim().toUpperCase()
      : null
  const explicitReference = EXPLICIT_REFERENCE.exec(text)?.[1]?.toUpperCase() ?? null
  const paymentIntent = PAYMENT_QUERY.test(text)
  const deliveryIntent = DELIVERY_QUERY.test(normalizeText(text))
  const orderIntent = ORDER_QUERY.test(normalizeText(text))
  const compareIntent = COMPARE_QUERY.test(normalizeText(text))
  const recommendationIntent = RECOMMEND_QUERY.test(text)
  const productIntent = PRODUCT_QUERY.test(text)

  let intent: WhatsAppAssistantIntent
  if (explicitHuman) intent = 'human_requested'
  else if (optOut) intent = 'opt_out'
  else if (GREETING.test(normalizeText(text))) intent = 'greeting'
  else if (
    (explicitReference && hasPaymentReference) ||
    bareReference ||
    input.state.awaitingPaymentReference ||
    paymentAlreadyMade
  )
    intent = 'payment_reference'
  else if (orderCode && paymentIntent) intent = 'payment_help'
  else if (orderIntent && orderCode) intent = 'delivery_status'
  else if (deliveryIntent) intent = 'delivery_options'
  else if (compareIntent && matches.length > 0) intent = 'product_comparison'
  else if (recommendationIntent) intent = 'product_recommendation'
  else if (product && (mentionedProduct || input.state.productSlug) && productIntent)
    intent = 'product_question'
  else if (product && (mentionedProduct || input.state.productSlug)) intent = 'product_search'
  else if (orderIntent || orderCode) intent = 'order_status'
  else if (paymentIntent) intent = 'payment_help'
  else if (hint.intent) intent = hint.intent
  else if (CATEGORY_WORDS.some((category) => normalizeText(text).includes(category)))
    intent = 'product_recommendation'
  else intent = 'unknown'

  if (hint.intent && intent === 'unknown') {
    intent = hint.intent
  }

  const productSlug = product?.slug ?? input.state.productSlug
  const nextState: WhatsAppConversationState = {
    productSlug,
    size,
    color,
    quantity,
    orderCode: orderCode ?? input.state.orderCode,
    preferenceCategory: recommendationIntent
      ? (product?.category ?? input.state.preferenceCategory)
      : input.state.preferenceCategory,
    preferenceSize: size ?? input.state.preferenceSize,
    preferenceColor: color ?? input.state.preferenceColor,
    awaitingPaymentReference:
      intent === 'payment_reference' && !explicitReference && orderCode !== null,
  }

  return {
    intent,
    productSlug,
    matchedProductSlugs: matches.map((item) => item.slug),
    size,
    color,
    quantity,
    orderCode,
    paymentReference: explicitReference ?? bareReference,
    nextState,
  }
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace('.', ',')} USD`
}

function availableVariants(product: WhatsAppCatalogProductFact): string {
  const available = product.variants.filter((variant) => variant.stock > 0)
  if (!available.length) return 'Agotado por ahora.'
  const sizes = [...new Set(available.map((variant) => variant.size))]
  const colors = [...new Set(available.map((variant) => variant.color))]
  return `Tallas disponibles: ${sizes.join(', ')}. Colores disponibles: ${colors.join(', ')}.`
}

function describeProduct(product: WhatsAppCatalogProductFact): string {
  return `${product.name} — ${formatPrice(product.priceCents)}. ${availableVariants(product)}`
}

function renderOrderStatus(order: WhatsAppOrderSummaryFact): string {
  const lines = [
    `El pedido ${order.code} está ${order.orderStatus === 'awaiting_payment' ? 'pendiente de pago' : order.orderStatus === 'inventory_exception' ? 'en revisión por una incidencia de inventario' : order.orderStatus === 'cancelled' ? 'cancelado' : 'confirmado'}.`,
    `Pago: ${order.paymentStatus === 'pending' ? 'pendiente de revisión' : order.paymentStatus === 'review' ? 'en revisión manual' : order.paymentStatus === 'paid' ? 'confirmado por la tienda' : order.paymentStatus === 'rejected' ? 'rechazado por la tienda' : 'cancelado'}.`,
    `Preparación y envío: ${order.fulfillmentStatus === 'new' ? 'nuevo, aún no preparado' : order.fulfillmentStatus === 'preparing' ? 'en preparación' : order.fulfillmentStatus === 'shipped' ? 'despachado' : order.fulfillmentStatus === 'delivered' ? 'entregado' : 'cancelado'}.`,
  ]
  if (order.deliveryMethod === 'envio_nacional' && order.shippingAgency) {
    lines.push(`Agencia indicada en el pedido: ${order.shippingAgency}.`)
  }
  if (order.shippingCompany || order.shippingTrackingNumber) {
    lines.push(
      `Despacho manual: ${order.shippingCompany ?? 'empresa no registrada'} · guía ${order.shippingTrackingNumber ?? 'no registrada'}.`,
    )
  }
  if (order.shippingNotes) {
    lines.push(`Observaciones de envío: ${order.shippingNotes}.`)
  }
  if (order.fulfillmentStatus === 'shipped' && !order.shippingTrackingNumber) {
    lines.push('No hay un transportista o número de guía registrado en el sistema.')
  }
  return lines.join('\n')
}

export function composeWhatsAppReply(input: ComposeWhatsAppReplyInput): WhatsAppAssistantReply {
  const { analysis } = input
  const productBySlug = new Map(input.products.map((product) => [product.slug, product]))
  const selectedProduct = analysis.productSlug
    ? (productBySlug.get(analysis.productSlug) ?? null)
    : null
  const matchedProducts = analysis.matchedProductSlugs
    .map((slug) => productBySlug.get(slug))
    .filter((product): product is WhatsAppCatalogProductFact => product !== undefined)
  const order = input.order
  const matchingOrders = input.matchingOrders ?? []
  let message: string
  let handoffReason: WhatsAppAssistantReply['handoffReason'] = null
  let submitPaymentReference: string | null = null

  if (analysis.intent === 'opt_out') {
    return {
      message: '',
      intent: analysis.intent,
      nextState: analysis.nextState,
      handoffReason: null,
      optOut: true,
      submitPaymentReference: null,
    }
  }

  if (analysis.intent === 'human_requested') {
    message =
      'Claro, dejo tu solicitud al equipo de Norte Moda para que una persona continúe contigo. Por seguridad, no envíes claves bancarias, códigos de un solo uso ni datos completos de tarjetas o cuentas.'
    handoffReason = 'human_requested'
  } else if (analysis.intent === 'greeting') {
    message =
      '¡Hola! Soy el asistente virtual de Norte Moda. Puedo ayudarte con prendas, tallas, colores, disponibilidad, pagos y pedidos. Cuéntame qué necesitas y lo reviso con la información de la tienda.'
  } else if (analysis.intent === 'product_question' && selectedProduct) {
    const variant = selectedProduct.variants.find(
      (item) =>
        (!analysis.size || item.size.toLowerCase() === analysis.size.toLowerCase()) &&
        (!analysis.color || normalizeText(item.color) === normalizeText(analysis.color)),
    )
    const details = variant
      ? `Para ${variant.size} en ${variant.color}, el sistema muestra ${String(variant.stock)} ${variant.stock === 1 ? 'unidad disponible' : 'unidades disponibles'} ahora.`
      : availableVariants(selectedProduct)
    message = `${selectedProduct.name} cuesta ${formatPrice(selectedProduct.priceCents)}. ${details} El precio y el stock se vuelven a validar al confirmar el pedido.`
  } else if (analysis.intent === 'product_search' && selectedProduct) {
    message = `Encontré esta opción en el catálogo: ${describeProduct(selectedProduct)} ¿Quieres que revise alguna talla o color en particular?`
  } else if (analysis.intent === 'product_comparison') {
    if (matchedProducts.length < 2) {
      message =
        'Puedo compararlos con el catálogo, pero no identifiqué con seguridad los dos modelos. ¿Cuáles son sus nombres?'
    } else {
      message =
        matchedProducts.slice(0, 2).map(describeProduct).join('\n') +
        '\nLa diferencia de precio y las variantes disponibles salen de la ficha actual de cada producto.'
    }
  } else if (analysis.intent === 'product_recommendation') {
    const ranked = input.products
      .filter((item) => item.variants.some((variant) => variant.stock > 0))
      .filter(
        (item) =>
          !analysis.size ||
          item.variants.some(
            (variant) =>
              variant.size.toLowerCase() === analysis.size?.toLowerCase() && variant.stock > 0,
          ),
      )
      .filter(
        (item) =>
          !analysis.color ||
          item.variants.some(
            (variant) =>
              normalizeText(variant.color) === normalizeText(analysis.color ?? '') &&
              variant.stock > 0,
          ),
      )
      .filter((item) => !analysis.productSlug || item.slug !== analysis.productSlug)
      .slice(0, 3)
    message = ranked.length
      ? `Revisé el catálogo y estas opciones tienen stock ahora:\n${ranked.map(describeProduct).join('\n')}\nSi me dices para qué ocasión o qué estilo prefieres, afino la búsqueda.`
      : 'No encuentro opciones disponibles con esos datos ahora. ¿Qué talla o color te gustaría revisar?'
  } else if (analysis.intent === 'purchase_help') {
    message = selectedProduct
      ? `Puedo orientarte con ${selectedProduct.name}. Para finalizar, completa el checkout del sitio: allí se verifican de nuevo el precio y las existencias, y eliges una forma de entrega y un método de pago habilitado.`
      : 'Puedes completar tu compra desde el checkout del sitio. Allí eliges la variante, la entrega y uno de los métodos manuales que la tienda haya activado. ¿Qué producto quieres comprar?'
  } else if (analysis.intent === 'order_status' || analysis.intent === 'delivery_status') {
    if (order) {
      message = renderOrderStatus(order)
      if (
        analysis.intent === 'delivery_status' &&
        !order.shippingTrackingNumber &&
        order.fulfillmentStatus !== 'delivered'
      ) {
        message += '\nTodavía no hay una guía de despacho registrada.'
      }
    } else if (matchingOrders.length > 1) {
      message = `Encontré varios pedidos asociados a este número. ¿Cuál quieres consultar: ${matchingOrders.map((item) => item.code).join(', ')}?`
    } else {
      message =
        'No pude asociar un pedido a este número. Envíame el código NM-XXXX que aparece en la confirmación de compra y lo verifico sin mostrar datos de otra persona.'
    }
  } else if (analysis.intent === 'payment_help') {
    if (order) {
      if (order.paymentInstructions?.trim()) {
        message = `El pago del pedido ${order.code} está ${order.paymentStatus === 'review' ? 'en revisión manual' : order.paymentStatus === 'paid' ? 'confirmado por la tienda' : order.paymentStatus === 'rejected' ? 'rechazado por la tienda' : 'pendiente de revisión'}.\n${order.paymentInstructions.trim()}\nCompartir estas instrucciones no confirma el pago. La aprobación la registra una persona autorizada.`
      } else {
        message = `No veo instrucciones guardadas para ${order.code}. No transfieras dinero todavía; dejo el caso al equipo para verificar la configuración.`
        handoffReason = 'payment_instructions_missing'
      }
    } else if ((input.paymentOptions ?? []).length) {
      message = `La tienda tiene habilitados estos métodos manuales: ${(input.paymentOptions ?? []).map((option) => option.label).join(', ')}. Las instrucciones completas se confirman dentro de un pedido para evitar indicarte datos o montos equivocados. ¿Tienes el código de tu pedido?`
    } else {
      message =
        'No hay métodos de pago manuales habilitados en la tienda ahora. No transfieras dinero; puedo dejar tu consulta a una persona.'
      handoffReason = 'payment_instructions_missing'
    }
  } else if (analysis.intent === 'payment_reference') {
    if (!order) {
      message =
        'Para asociar la referencia de pago de forma segura, primero necesito el código NM-XXXX del pedido.'
    } else if (!analysis.paymentReference) {
      message = `Puedo asociar una referencia de operación al pedido ${order.code}. Envíame solo el número de referencia que aparece en el comprobante; no compartas claves, OTP ni datos bancarios.`
    } else if (input.paymentReferenceResult === 'submitted') {
      message = `Recibí la referencia para ${order.code} y quedó pendiente de revisión manual. El envío de un comprobante o una referencia no confirma el pago; una persona autorizada debe verificarlo.`
      handoffReason = 'payment_reference_submitted'
      submitPaymentReference = analysis.paymentReference
    } else if (input.paymentReferenceResult === 'already_verified') {
      message = `El pedido ${order.code} ya tiene un estado de pago registrado por la tienda. No cambié ese estado. Si necesitas revisarlo, puedo pedir ayuda humana.`
      handoffReason = 'human_requested'
    } else if (input.paymentReferenceResult === 'not_found') {
      message =
        'No pude asociar esa referencia con un pedido pendiente de pago de este número. Revisa el código del pedido o solicita ayuda humana; no cambié ningún estado.'
      handoffReason = 'human_requested'
    } else {
      message =
        'No pude registrar la referencia. No cambié el estado del pago; dejo el caso para que una persona lo revise.'
      handoffReason = 'human_requested'
    }
  } else if (analysis.intent === 'delivery_options') {
    const configured = (input.deliveryOptions ?? []).filter((option) => !option.demoOnly)
    if (!configured.length) {
      message =
        'La tienda aún no tiene tarifas de entrega verificadas configuradas. El pedido puede registrar delivery local, envío nacional con una agencia indicada por el comprador o retiro, pero el costo debe confirmarlo el equipo. No tenemos una conexión oficial con MRW o Zoom ni puedo inventar una guía.'
      handoffReason = 'unknown_request'
    } else {
      message = `Estas son las opciones y tarifas configuradas:\n${configured.map((option) => `${option.method === 'delivery_local' ? 'Delivery local' : option.method === 'envio_nacional' ? 'Envío nacional' : 'Retiro'}: ${formatPrice(option.amountCents)}`).join('\n')}\nLa guía y el despacho se informan solo cuando el equipo actualice el pedido.`
    }
  } else {
    message =
      'No logré identificar qué necesitas y no quiero adivinar. Puedo revisar un producto, un pedido o pedir ayuda al equipo. ¿Cuál de esos temas quieres consultar?'
    handoffReason = 'unknown_request'
  }

  return {
    message,
    intent: analysis.intent,
    nextState: analysis.nextState,
    handoffReason,
    optOut: false,
    submitPaymentReference,
  }
}

export function findWhatsAppProductMatches(
  query: string,
  products: readonly WhatsAppCatalogProductFact[],
  limit = 3,
): readonly WhatsAppCatalogProductFact[] {
  return topProductMatches(query, products).slice(0, Math.max(1, Math.min(limit, 3)))
}
