import { getServiceClient, json } from '../_shared/http.ts'
import {
  sendWhatsAppApprovedOrderTemplate,
  sendWhatsAppSessionText,
  type WhatsAppCloudConfig,
} from '../../../src/lib/whatsappCloudApi.ts'

const ID_PATTERN = /^[A-Za-z0-9:_-]{4,255}$/
const PHONE_PATTERN = /^[0-9]{8,15}$/
const ORDER_CODE_PATTERN = /^NM-[0-9]{3,}$/i
const TEMPLATE_PATTERN = /^[a-z0-9_]{1,128}$/
const LANGUAGE_PATTERN = /^[a-z]{2}(?:_[A-Z]{2})?$/
const BATCH_SIZE = 30

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(request, 405, { error: 'Method not allowed.' })
  const dispatchSecret = Deno.env.get('WHATSAPP_DISPATCH_SECRET') ?? ''
  if (!hasValidDispatchSecret(request, dispatchSecret)) {
    return json(request, 401, { error: 'Unauthorized.' })
  }
  if (Deno.env.get('WHATSAPP_SEND_ENABLED') !== 'true') {
    return json(request, 200, { enabled: false, repliesSent: 0, orderTemplatesSent: 0 })
  }

  const cloudConfig = getCloudConfig()
  if (!isCloudConfigReady(cloudConfig)) {
    return json(request, 503, { error: 'WhatsApp Cloud API sender is not configured.' })
  }

  let service: ReturnType<typeof getServiceClient>
  try {
    service = getServiceClient()
  } catch {
    return json(request, 503, { error: 'WhatsApp backend is not configured.' })
  }

  let repliesSent = 0
  let orderTemplatesSent = 0
  const errors: string[] = []

  const replyRows = await loadReadyReplies(service)
  if (replyRows === null)
    return json(request, 503, { error: 'WhatsApp reply queue is unavailable.' })
  for (const row of replyRows) {
    const { data, error } = await service.rpc('claim_whatsapp_reply', {
      p_provider_event_id: row.provider_event_id,
    })
    if (error) {
      errors.push('reply_claim_failed')
      continue
    }
    if (!isRecord(data)) continue
    const eventId = stringField(data, 'providerEventId')
    const recipient = stringField(data, 'recipientPhone')
    const body = stringField(data, 'body')
    const windowExpiresAt = stringField(data, 'windowExpiresAt')
    if (
      eventId !== row.provider_event_id ||
      !ID_PATTERN.test(eventId) ||
      !PHONE_PATTERN.test(recipient) ||
      !body ||
      body.length > 2000 ||
      !Number.isFinite(Date.parse(windowExpiresAt))
    ) {
      await service.rpc('finish_whatsapp_reply', {
        p_provider_event_id: row.provider_event_id,
        p_status: 'failed',
        p_provider_message_id: null,
        p_error_code: 'invalid_queue_payload',
      })
      errors.push('invalid_reply_payload')
      continue
    }
    const result = await sendWhatsAppSessionText({
      config: cloudConfig,
      recipient,
      text: body,
      windowExpiresAt,
    })
    const { error: finishError } = await service.rpc('finish_whatsapp_reply', {
      p_provider_event_id: eventId,
      p_status: result.sent ? 'sent' : 'failed',
      p_provider_message_id: result.providerMessageId,
      p_error_code: result.errorCode,
    })
    if (finishError) errors.push('reply_status_save_failed')
    if (result.sent) repliesSent += 1
    else errors.push(result.errorCode ?? 'reply_send_failed')
  }

  const templateApproved = Deno.env.get('WHATSAPP_ORDER_TEMPLATE_APPROVED') === 'true'
  const templateName = Deno.env.get('WHATSAPP_ORDER_TEMPLATE_NAME') ?? ''
  const languageCode = Deno.env.get('WHATSAPP_ORDER_TEMPLATE_LANGUAGE') ?? ''
  if (
    templateApproved &&
    TEMPLATE_PATTERN.test(templateName) &&
    LANGUAGE_PATTERN.test(languageCode)
  ) {
    const followups = await loadReadyFollowups(service)
    if (followups === null) {
      errors.push('order_followup_queue_unavailable')
    } else {
      for (const row of followups) {
        const { data, error } = await service.rpc('claim_whatsapp_order_followup', {
          p_order_id: row.order_id,
          p_sender_hash: row.sender_hash,
        })
        if (error) {
          errors.push('order_followup_claim_failed')
          continue
        }
        if (!isRecord(data)) continue
        const orderId = stringField(data, 'orderId')
        const orderCode = stringField(data, 'code')
        const recipient = stringField(data, 'phone')
        if (
          orderId !== row.order_id ||
          !ORDER_CODE_PATTERN.test(orderCode) ||
          !PHONE_PATTERN.test(recipient)
        ) {
          await service.rpc('finish_whatsapp_order_followup', {
            p_order_id: row.order_id,
            p_status: 'failed',
            p_provider_message_id: null,
            p_error_code: 'invalid_queue_payload',
          })
          errors.push('invalid_order_followup_payload')
          continue
        }
        const result = await sendWhatsAppApprovedOrderTemplate({
          config: cloudConfig,
          recipient,
          orderCode,
          consented: true,
          optedOut: false,
          templateApproved,
          templateName,
          languageCode,
        })
        const { error: finishError } = await service.rpc('finish_whatsapp_order_followup', {
          p_order_id: row.order_id,
          p_status: result.sent ? 'sent' : 'failed',
          p_provider_message_id: result.providerMessageId,
          p_error_code: result.errorCode,
        })
        if (finishError) errors.push('order_followup_status_save_failed')
        if (result.sent) orderTemplatesSent += 1
        else errors.push(result.errorCode ?? 'order_followup_send_failed')
      }
    }
  }

  if (errors.length > 0) {
    console.error('whatsapp-outbox completed with issues', { codes: [...new Set(errors)] })
  }
  return json(request, 200, {
    enabled: true,
    repliesSent,
    orderTemplatesSent,
    issues: [...new Set(errors)],
  })
})

async function loadReadyReplies(
  service: ReturnType<typeof getServiceClient>,
): Promise<Record<string, unknown>[] | null> {
  const retryBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const now = new Date().toISOString()
  const [pending, failed, expiredLeases] = await Promise.all([
    service
      .from('whatsapp_outbound_messages')
      .select('provider_event_id')
      .eq('status', 'pending')
      .lt('attempt_count', 5)
      .gt('window_expires_at', now)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE),
    service
      .from('whatsapp_outbound_messages')
      .select('provider_event_id')
      .eq('status', 'failed')
      .lt('attempt_count', 5)
      .lt('updated_at', retryBefore)
      .gt('window_expires_at', now)
      .order('updated_at', { ascending: true })
      .limit(BATCH_SIZE),
    service
      .from('whatsapp_outbound_messages')
      .select('provider_event_id')
      .eq('status', 'sending')
      .lt('attempt_count', 5)
      .lt('lease_expires_at', now)
      .gt('window_expires_at', now)
      .order('updated_at', { ascending: true })
      .limit(BATCH_SIZE),
  ])
  if (pending.error || failed.error || expiredLeases.error) return null
  return [...(pending.data ?? []), ...(failed.data ?? []), ...(expiredLeases.data ?? [])].slice(
    0,
    BATCH_SIZE,
  )
}

async function loadReadyFollowups(
  service: ReturnType<typeof getServiceClient>,
): Promise<{ order_id: string; sender_hash: string }[] | null> {
  const retryBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const [pending, failed, expiredLeases] = await Promise.all([
    service
      .from('whatsapp_order_followups')
      .select('order_id,sender_hash')
      .eq('status', 'pending')
      .lt('attempt_count', 5)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE),
    service
      .from('whatsapp_order_followups')
      .select('order_id,sender_hash')
      .eq('status', 'failed')
      .lt('attempt_count', 5)
      .lt('updated_at', retryBefore)
      .order('updated_at', { ascending: true })
      .limit(BATCH_SIZE),
    service
      .from('whatsapp_order_followups')
      .select('order_id,sender_hash')
      .eq('status', 'sending')
      .lt('lease_expires_at', new Date().toISOString())
      .lt('attempt_count', 5)
      .order('updated_at', { ascending: true })
      .limit(BATCH_SIZE),
  ])
  if (pending.error || failed.error || expiredLeases.error) return null
  return [...(pending.data ?? []), ...(failed.data ?? []), ...(expiredLeases.data ?? [])].slice(
    0,
    BATCH_SIZE,
  )
}

function getCloudConfig(): WhatsAppCloudConfig {
  return {
    enabled: Deno.env.get('WHATSAPP_SEND_ENABLED') === 'true',
    accessToken: Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? undefined,
    phoneNumberId: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? undefined,
    graphApiVersion: Deno.env.get('WHATSAPP_GRAPH_API_VERSION') ?? undefined,
  }
}

function isCloudConfigReady(config: WhatsAppCloudConfig): boolean {
  return (
    config.enabled &&
    typeof config.accessToken === 'string' &&
    config.accessToken.length > 0 &&
    typeof config.phoneNumberId === 'string' &&
    /^[0-9]{5,30}$/.test(config.phoneNumberId) &&
    typeof config.graphApiVersion === 'string' &&
    /^v[0-9]{1,3}\.0$/.test(config.graphApiVersion)
  )
}

function hasValidDispatchSecret(request: Request, expected: string): boolean {
  if (expected.length < 32) return false
  const supplied = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1] ?? ''
  const encoder = new TextEncoder()
  const expectedBytes = encoder.encode(expected)
  const suppliedBytes = encoder.encode(supplied)
  if (expectedBytes.length !== suppliedBytes.length) return false
  let difference = 0
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= (expectedBytes[index] ?? 0) ^ (suppliedBytes[index] ?? 0)
  }
  return difference === 0
}

function stringField(record: Record<string, unknown>, key: string): string {
  return typeof record[key] === 'string' ? record[key].trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
