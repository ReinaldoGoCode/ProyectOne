export interface WhatsAppWebhookEvent {
  readonly id: string
  readonly type: string
  readonly providerMessageId?: string
  readonly status?: string
  readonly timestamp?: string | null
  readonly errorCode?: string | null
}

export interface WhatsAppInboundMessage {
  readonly id: string
  readonly from: string
  readonly text: string
  readonly type: string
  readonly timestamp: string | null
}

export function deduplicateWhatsAppEvents(
  events: readonly WhatsAppWebhookEvent[],
): WhatsAppWebhookEvent[] {
  const seen = new Set<string>()
  return events.filter((event) => {
    if (seen.has(event.id)) return false
    seen.add(event.id)
    return true
  })
}

export async function verifyWhatsAppWebhookSignature(
  body: ArrayBuffer,
  appSecret: string,
  signature: string,
): Promise<boolean> {
  if (!/^sha256=[0-9a-f]{64}$/i.test(signature) || appSecret.length < 1) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, body)
  const expected = `sha256=${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`
  const normalized = signature.toLowerCase()
  let difference = expected.length ^ normalized.length
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ (normalized.charCodeAt(index) || 0)
  }
  return difference === 0
}

export async function hashWhatsAppPhone(phone: string, secret: string): Promise<string> {
  const normalized = phone.replace(/\D/g, '')
  if (!/^[0-9]{8,15}$/.test(normalized) || secret.length < 32) {
    throw new RangeError('WhatsApp phone hashing is not configured.')
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(normalized))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function extractWhatsAppEvents(payload: unknown): WhatsAppWebhookEvent[] {
  if (!isRecord(payload) || !Array.isArray(payload['entry'])) return []
  const events: WhatsAppWebhookEvent[] = []
  for (const entry of payload['entry']) {
    if (!isRecord(entry) || !Array.isArray(entry['changes'])) continue
    for (const change of entry['changes']) {
      if (!isRecord(change) || !isRecord(change['value'])) continue
      const value = change['value']
      if (Array.isArray(value['messages'])) {
        for (const message of value['messages']) {
          if (isRecord(message) && isValidId(message['id'])) {
            events.push({ id: message['id'], type: 'incoming_message' })
          }
        }
      }
      if (Array.isArray(value['statuses'])) {
        for (const status of value['statuses']) {
          if (
            isRecord(status) &&
            isValidId(status['id']) &&
            typeof status['status'] === 'string' &&
            /^[a-z_]{1,30}$/i.test(status['status'])
          ) {
            const seconds =
              typeof status['timestamp'] === 'string' ? Number(status['timestamp']) : NaN
            const timestamp =
              Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 8_640_000_000
                ? new Date(seconds * 1000).toISOString()
                : null
            const firstError = getFirstArrayItem(status['errors'])
            const rawErrorCode =
              isRecord(firstError) && Number.isSafeInteger(firstError['code'])
                ? `meta_${String(firstError['code'])}`
                : isRecord(firstError) &&
                    typeof firstError['type'] === 'string' &&
                    /^[A-Za-z0-9_-]{1,60}$/.test(firstError['type'])
                  ? `meta_${firstError['type']}`
                  : null
            events.push({
              id: `${status['id']}:${status['status']}`,
              type: `message_status_${status['status']}`,
              providerMessageId: status['id'],
              status: status['status'].toLowerCase(),
              timestamp,
              errorCode: rawErrorCode,
            })
          }
        }
      }
    }
  }
  return events
}

export function extractWhatsAppInboundMessages(payload: unknown): WhatsAppInboundMessage[] {
  if (!isRecord(payload) || !Array.isArray(payload['entry'])) return []
  const messages: WhatsAppInboundMessage[] = []
  for (const entry of payload['entry']) {
    if (!isRecord(entry) || !Array.isArray(entry['changes'])) continue
    for (const change of entry['changes']) {
      if (
        !isRecord(change) ||
        !isRecord(change['value']) ||
        !Array.isArray(change['value']['messages'])
      )
        continue
      for (const message of change['value']['messages']) {
        if (!isRecord(message) || !isValidId(message['id']) || typeof message['from'] !== 'string')
          continue
        const type = typeof message['type'] === 'string' ? message['type'].slice(0, 30) : 'unknown'
        const body =
          isRecord(message['text']) && typeof message['text']['body'] === 'string'
            ? message['text']['body']
            : type === 'image' &&
                isRecord(message['image']) &&
                typeof message['image']['caption'] === 'string'
              ? message['image']['caption']
              : ''
        const seconds =
          typeof message['timestamp'] === 'string' ? Number(message['timestamp']) : NaN
        const timestamp =
          Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 8_640_000_000
            ? new Date(seconds * 1000).toISOString()
            : null
        messages.push({
          id: message['id'],
          from: message['from'],
          text: body.slice(0, 1500),
          type,
          timestamp,
        })
      }
    }
  }
  return messages
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getFirstArrayItem(value: unknown): unknown {
  if (!Array.isArray(value) || value.length === 0) return null
  return value[0] as unknown
}

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 4 && value.length <= 255
}
