export interface WhatsAppCloudConfig {
  readonly enabled: boolean
  readonly accessToken?: string
  readonly phoneNumberId?: string
  readonly graphApiVersion?: string
}

export interface WhatsAppSendResult {
  readonly sent: boolean
  readonly providerMessageId: string | null
  readonly errorCode: string | null
}

export async function sendWhatsAppSessionText(input: {
  readonly config: WhatsAppCloudConfig
  readonly recipient: string
  readonly text: string
  readonly windowExpiresAt: string
  readonly now?: number
  readonly fetcher?: typeof fetch
}): Promise<WhatsAppSendResult> {
  const now = input.now ?? Date.now()
  const expiresAt = Date.parse(input.windowExpiresAt)
  if (!input.config.enabled || !isCloudConfigReady(input.config)) return failed('not_configured')
  if (
    !/^[0-9]{8,15}$/.test(input.recipient) ||
    input.text.trim().length < 1 ||
    input.text.length > 2000 ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + 24 * 60 * 60 * 1000 + 60_000
  ) {
    return failed('outside_customer_service_window')
  }
  return sendCloudMessage(
    input.config,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.recipient,
      type: 'text',
      text: { body: input.text, preview_url: false },
    },
    input.fetcher,
  )
}

export async function sendWhatsAppApprovedOrderTemplate(input: {
  readonly config: WhatsAppCloudConfig
  readonly recipient: string
  readonly orderCode: string
  readonly consented: boolean
  readonly optedOut: boolean
  /** Must be set only after Meta confirms this template is approved. */
  readonly templateApproved: boolean
  readonly templateName?: string
  readonly languageCode?: string
  readonly fetcher?: typeof fetch
}): Promise<WhatsAppSendResult> {
  if (!input.config.enabled || !isCloudConfigReady(input.config)) return failed('not_configured')
  if (!input.consented || input.optedOut) return failed('consent_required')
  if (!input.templateApproved) return failed('approved_template_not_confirmed')
  if (
    !/^[0-9]{8,15}$/.test(input.recipient) ||
    !/^NM-\d{3,}$/i.test(input.orderCode) ||
    !input.templateName ||
    !/^[a-z0-9_]{1,128}$/.test(input.templateName) ||
    !input.languageCode ||
    !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(input.languageCode)
  ) {
    return failed('approved_template_not_configured')
  }
  return sendCloudMessage(
    input.config,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.recipient,
      type: 'template',
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: input.orderCode.toUpperCase() }],
          },
        ],
      },
    },
    input.fetcher,
  )
}

function isCloudConfigReady(config: WhatsAppCloudConfig): config is WhatsAppCloudConfig & {
  readonly accessToken: string
  readonly phoneNumberId: string
  readonly graphApiVersion: string
} {
  return (
    typeof config.accessToken === 'string' &&
    config.accessToken.length > 0 &&
    typeof config.phoneNumberId === 'string' &&
    /^[0-9]{5,30}$/.test(config.phoneNumberId) &&
    typeof config.graphApiVersion === 'string' &&
    /^v[0-9]{1,3}\.0$/.test(config.graphApiVersion)
  )
}

async function sendCloudMessage(
  config: WhatsAppCloudConfig,
  body: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
): Promise<WhatsAppSendResult> {
  if (!isCloudConfigReady(config)) return failed('not_configured')
  try {
    const response = await fetcher(
      `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.accessToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify(body),
      },
    )
    const responseText = await response.text()
    if (responseText.length > 20_000) return failed(`http_${String(response.status)}`)
    const payload = responseText ? parseJsonUnknown(responseText) : null
    if (!response.ok)
      return failed(extractProviderErrorCode(payload) ?? `http_${String(response.status)}`)
    const providerMessageId = extractProviderMessageId(payload)
    return providerMessageId
      ? { sent: true, providerMessageId, errorCode: null }
      : failed('invalid_provider_response')
  } catch {
    return failed('network_error')
  }
}

function extractProviderMessageId(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value['messages'])) return null
  const message = getFirstArrayItem(value['messages'])
  return isRecord(message) && typeof message['id'] === 'string' && message['id'].length <= 255
    ? message['id']
    : null
}

function extractProviderErrorCode(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value['error'])) return null
  const error = value['error']
  if (Number.isSafeInteger(error['code'])) return `meta_${String(error['code'])}`
  return typeof error['type'] === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(error['type'])
    ? `meta_${error['type']}`
    : null
}

function failed(errorCode: string): WhatsAppSendResult {
  return { sent: false, providerMessageId: null, errorCode }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getFirstArrayItem(value: unknown): unknown {
  if (!Array.isArray(value) || value.length === 0) return null
  return value[0] as unknown
}

function parseJsonUnknown(value: string): unknown {
  return JSON.parse(value) as never
}
