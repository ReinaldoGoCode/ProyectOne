import { corsHeaders, getServiceClient, isAllowedOrigin, json, sha256Hex } from '../_shared/http.ts'

const ORDER_CODE = /^NM-[0-9]{3,12}$/
const TRACKING_TOKEN = /^[0-9a-f]{64}$/i
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._ -]{3,79}$/
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024
const RECEIPT_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['application/pdf', 'pdf'],
])

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, 405, { error: 'Method not allowed.' })
  if (!isAllowedOrigin(request)) return json(request, 403, { error: 'Origin not allowed.' })
  try {
    const contentType = request.headers.get('content-type') ?? ''
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (Number.isFinite(contentLength) && contentLength > MAX_RECEIPT_BYTES + 128 * 1024) {
      return json(request, 413, { error: 'El comprobante no puede superar 5 MB.' })
    }

    // Compatibility path for older clients. It can record a reference but never a receipt or approval.
    if (contentType.includes('application/json')) {
      const body: unknown = await request.json()
      if (!isRecord(body)) return json(request, 400, { error: 'Solicitud inválida.' })
      const code = stringValue(body.code).toUpperCase()
      const trackingToken = stringValue(body.trackingToken)
      const reference = stringValue(body.reference)
      const note = stringValue(body.note).slice(0, 300)
      if (
        !ORDER_CODE.test(code) ||
        !TRACKING_TOKEN.test(trackingToken) ||
        !REFERENCE.test(reference)
      ) {
        return json(request, 400, { error: 'El código, el enlace o la referencia no son válidos.' })
      }
      const client = getServiceClient()
      const { data, error } = await client.rpc('submit_public_payment_reference', {
        p_code: code,
        p_tracking_token_hash: await sha256Hex(trackingToken.toLowerCase()),
        p_reference: reference,
        p_note: note,
      })
      if (error || !data) return paymentError(request, error)
      return json(request, 200, { result: data })
    }
    if (!contentType.includes('multipart/form-data')) {
      return json(request, 415, { error: 'Se requiere un reporte de pago con formulario seguro.' })
    }

    const formBody = await readLimitedBody(request, MAX_RECEIPT_BYTES + 128 * 1024)
    if (!formBody) return json(request, 413, { error: 'El comprobante no puede superar 5 MB.' })
    const form = await new Request(request.url, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: formBody,
    }).formData()
    const code = stringValue(form.get('code')).toUpperCase()
    const trackingToken = stringValue(form.get('trackingToken'))
    const reference = stringValue(form.get('reference'))
    const note = stringValue(form.get('note')).slice(0, 300)
    const amountCentsText = stringValue(form.get('amountCents'))
    const currency = stringValue(form.get('currency'))
    const paidAt = stringValue(form.get('paidAt'))
    const receiptValue = form.get('receipt')
    const receipt = receiptValue instanceof File && receiptValue.size > 0 ? receiptValue : null
    const amountCents = Number(amountCentsText)

    if (
      !ORDER_CODE.test(code) ||
      !TRACKING_TOKEN.test(trackingToken) ||
      !REFERENCE.test(reference) ||
      !/^\d+$/.test(amountCentsText) ||
      !Number.isSafeInteger(amountCents) ||
      amountCents < 1 ||
      currency !== 'VES' ||
      !isValidPaymentDate(paidAt) ||
      !receipt ||
      receipt.size > MAX_RECEIPT_BYTES ||
      !RECEIPT_TYPES.has(receipt.type) ||
      !(await isReceiptSignatureValid(receipt))
    ) {
      return json(request, 400, {
        error:
          'Verifica la referencia, el monto, la fecha y el comprobante (JPG, PNG, WebP o PDF de hasta 5 MB).',
      })
    }

    const client = getServiceClient()
    const tokenHash = await sha256Hex(trackingToken.toLowerCase())
    const { data: order, error: lookupError } = await client.rpc('lookup_public_order', {
      p_code: code,
      p_tracking_token_hash: tokenHash,
    })
    if (lookupError || !isRecord(order)) {
      return json(request, 404, { error: 'No encontramos el pedido con ese enlace privado.' })
    }
    if (order['paymentMethod'] !== 'pago_movil') {
      return json(request, 409, { error: 'Este pedido no está configurado para Pago Móvil.' })
    }
    if (order['paymentStatus'] === 'paid' || order['paymentStatus'] === 'cancelled') {
      return json(request, 409, { error: 'El pedido no acepta reportes de pago en este estado.' })
    }

    const extension = RECEIPT_TYPES.get(receipt.type)
    if (!extension) return json(request, 400, { error: 'Tipo de comprobante no permitido.' })
    const receiptPath = `${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await client.storage
      .from('payment-receipts')
      .upload(receiptPath, receipt, {
        contentType: receipt.type,
        cacheControl: '0',
        upsert: false,
      })
    if (uploadError) {
      console.error('submit-payment-reference receipt upload failed', { code: uploadError.name })
      return json(request, 503, { error: 'No se pudo guardar el comprobante de forma privada.' })
    }

    let reportData: unknown = null
    let reportErrorCode: string | undefined
    try {
      const report = await client.rpc('submit_public_payment_report', {
        p_code: code,
        p_tracking_token_hash: tokenHash,
        p_reference: reference,
        p_note: note,
        p_reported_amount_cents: amountCents,
        p_reported_currency: currency,
        p_paid_at: paidAt,
        p_receipt_path: receiptPath,
      })
      reportData = report.data
      reportErrorCode = report.error?.code
    } catch {
      await client.storage.from('payment-receipts').remove([receiptPath])
      return json(request, 503, { error: 'No se pudo registrar el reporte de pago.' })
    }

    if (reportErrorCode || !isRecord(reportData)) {
      await client.storage.from('payment-receipts').remove([receiptPath])
      return paymentError(request, reportErrorCode ? { code: reportErrorCode } : null)
    }
    if (reportData['alreadySubmitted'] || reportData['alreadyVerified']) {
      await client.storage.from('payment-receipts').remove([receiptPath])
    }

    return json(request, 200, { result: reportData })
  } catch {
    return json(request, 400, { error: 'No se pudo procesar la solicitud.' })
  }
})

function paymentError(request: Request, error: { code?: string } | null) {
  if (error?.code === 'P0002') {
    return json(request, 404, { error: 'No encontramos el pedido con ese enlace privado.' })
  }
  if (error?.code === '22023') {
    return json(request, 409, { error: 'El pedido no acepta un reporte de pago en este momento.' })
  }
  console.error('submit-payment-reference failed', { code: error?.code ?? 'empty_result' })
  return json(request, 503, { error: 'No se pudo registrar el reporte de pago.' })
}

function isValidPaymentDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(date.valueOf()) &&
    date.toISOString().slice(0, 10) === value &&
    value <= new Date().toISOString().slice(0, 10)
  )
}

async function isReceiptSignatureValid(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (file.type === 'application/pdf') {
    return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
  }
  if (file.type === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (file.type === 'image/png') {
    return bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10'
  }
  if (file.type === 'image/webp') {
    return (
      new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
    )
  }
  return false
}

async function readLimitedBody(request: Request, limit: number): Promise<Uint8Array | null> {
  const reader = request.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > limit) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
