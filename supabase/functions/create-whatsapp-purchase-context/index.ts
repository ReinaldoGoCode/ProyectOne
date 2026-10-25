import { corsHeaders, getServiceClient, isAllowedOrigin, json, sha256Hex } from '../_shared/http.ts'

const MAX_BODY_BYTES = 4096
const TOKEN_BYTES = 32

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') {
    if (!origin || !isAllowedOrigin(request)) {
      return json(request, 403, { error: 'Origin not allowed.' })
    }
    return new Response('ok', {
      status: 204,
      headers: corsHeaders(request),
    })
  }
  if (request.method !== 'POST') return json(request, 405, { error: 'Method not allowed.' })
  if (!origin || !isAllowedOrigin(request)) {
    return json(request, 403, { error: 'Origin not allowed.' })
  }
  if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    return json(request, 415, { error: 'Se requiere contenido JSON.' })
  }

  try {
    const reader = request.body?.getReader()
    if (!reader) return json(request, 400, { error: 'Solicitud inválida.' })
    const chunks: Uint8Array[] = []
    let bodyLength = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bodyLength += value.byteLength
      if (bodyLength > MAX_BODY_BYTES) {
        await reader.cancel()
        return json(request, 413, { error: 'La solicitud es demasiado grande.' })
      }
      chunks.push(value)
    }
    const rawBody = new Uint8Array(bodyLength)
    let offset = 0
    for (const chunk of chunks) {
      rawBody.set(chunk, offset)
      offset += chunk.byteLength
    }
    const body: unknown = JSON.parse(new TextDecoder().decode(rawBody))
    if (!isRecord(body)) return json(request, 400, { error: 'Solicitud inválida.' })
    const variantId = typeof body.variantId === 'string' ? body.variantId.trim() : ''
    const quantity = body.quantity
    if (
      variantId.length < 1 ||
      variantId.length > 120 ||
      !Number.isInteger(quantity) ||
      (quantity as number) < 1 ||
      (quantity as number) > 10
    ) {
      return json(request, 400, { error: 'La variante o cantidad no es válida.' })
    }

    const token = randomToken()
    const reference = `NM-C-${token}`
    const client = getServiceClient()
    const { data, error } = await client.rpc('create_whatsapp_purchase_context', {
      p_token_hash: await sha256Hex(token),
      p_variant_id: variantId,
      p_quantity: quantity,
    })
    if (error || !isPurchaseSnapshot(data)) {
      if (error?.code === 'P0002') {
        return json(request, 409, { error: 'La variante no está disponible en esa cantidad.' })
      }
      if (error?.code === '22023')
        return json(request, 400, { error: 'La solicitud no es válida.' })
      console.error('create-whatsapp-purchase-context failed', {
        code: error?.code ?? 'invalid_snapshot',
      })
      return json(request, 503, { error: 'No se pudo preparar la consulta de compra.' })
    }

    const prefilledMessage = [
      'Hola, quiero consultar y continuar con esta compra.',
      `Producto: ${data.productName}.`,
      `Talla: ${data.size}; color: ${data.color}; cantidad: ${data.quantity}.`,
      `Precio consultado: ${formatCents(data.unitPriceCents)} USD por unidad.`,
      `Referencia de compra: ${reference}.`,
      'Por favor, vuelve a verificar precio y disponibilidad antes de tomar el pedido.',
    ].join('\n')
    const businessPhone = (Deno.env.get('WHATSAPP_BUSINESS_PHONE') ?? '').replace(/\D/g, '')
    const whatsappUrl = /^[0-9]{8,15}$/.test(businessPhone)
      ? `https://wa.me/${businessPhone}?text=${encodeURIComponent(prefilledMessage)}`
      : null

    return json(request, 201, {
      reference,
      expiresAt: data.expiresAt,
      product: {
        slug: data.productSlug,
        name: data.productName,
        size: data.size,
        color: data.color,
        quantity: data.quantity,
        unitPriceCents: data.unitPriceCents,
        stock: data.stock,
      },
      prefilledMessage,
      whatsappUrl,
    })
  } catch {
    return json(request, 400, { error: 'No se pudo procesar la solicitud.' })
  }
})

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
function formatCents(cents: number): string {
  return (cents / 100).toFixed(2)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPurchaseSnapshot(value: unknown): value is {
  productSlug: string
  productName: string
  size: string
  color: string
  quantity: number
  unitPriceCents: number
  stock: number
  expiresAt: string
} {
  return (
    isRecord(value) &&
    typeof value.productSlug === 'string' &&
    typeof value.productName === 'string' &&
    typeof value.size === 'string' &&
    typeof value.color === 'string' &&
    Number.isInteger(value.quantity) &&
    Number.isInteger(value.unitPriceCents) &&
    Number.isInteger(value.stock) &&
    typeof value.expiresAt === 'string'
  )
}
