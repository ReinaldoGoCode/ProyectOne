import { describe, expect, it, vi } from 'vitest'

import { sendWhatsAppApprovedOrderTemplate, sendWhatsAppSessionText } from '@/lib/whatsappCloudApi'

const CONFIG = {
  enabled: true,
  accessToken: 'stub-token',
  phoneNumberId: '1234567890',
  graphApiVersion: 'v25.0',
}

function successResponse(): Response {
  return new Response(JSON.stringify({ messages: [{ id: 'wamid.response-1234' }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('envíos de WhatsApp Cloud API', () => {
  it('solo permite texto libre dentro de la ventana desde el último mensaje entrante', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(successResponse())
    const result = await sendWhatsAppSessionText({
      config: CONFIG,
      recipient: '584121234567',
      text: 'Hola, revisé la disponibilidad actual.',
      windowExpiresAt: '2026-10-21T17:00:00.000Z',
      now: Date.parse('2026-10-21T16:00:00.000Z'),
      fetcher,
    })

    expect(result).toEqual({
      sent: true,
      providerMessageId: 'wamid.response-1234',
      errorCode: null,
    })
    const [url, request] = fetcher.mock.calls[0] ?? []
    expect(url).toBe('https://graph.facebook.com/v25.0/1234567890/messages')
    expect(request?.headers).toMatchObject({ authorization: 'Bearer stub-token' })

    const outsideWindow = await sendWhatsAppSessionText({
      config: CONFIG,
      recipient: '584121234567',
      text: 'Hola',
      windowExpiresAt: '2026-10-21T15:59:59.000Z',
      now: Date.parse('2026-10-21T16:00:00.000Z'),
      fetcher,
    })
    expect(outsideWindow.errorCode).toBe('outside_customer_service_window')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('solo envía plantilla iniciada por la empresa con consentimiento y plantilla configurada', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(successResponse())
    const blocked = await sendWhatsAppApprovedOrderTemplate({
      config: CONFIG,
      recipient: '584121234567',
      orderCode: 'NM-0012',
      consented: true,
      optedOut: true,
      templateApproved: true,
      templateName: 'order_status_update',
      languageCode: 'es_VE',
      fetcher,
    })
    const sent = await sendWhatsAppApprovedOrderTemplate({
      config: CONFIG,
      recipient: '584121234567',
      orderCode: 'NM-0012',
      consented: true,
      optedOut: false,
      templateApproved: true,
      templateName: 'order_status_update',
      languageCode: 'es_VE',
      fetcher,
    })

    expect(blocked.errorCode).toBe('consent_required')
    expect(sent.sent).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [, request] = fetcher.mock.calls[0] ?? []
    expect(typeof request?.body).toBe('string')
    const body: unknown = JSON.parse(request?.body as string)
    expect(JSON.stringify(body)).toContain('"type":"template"')
    expect(JSON.stringify(body)).toContain('NM-0012')
  })

  it('no inventa ni hace envíos cuando faltan credenciales, configuración o campos del proveedor', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const result = await sendWhatsAppApprovedOrderTemplate({
      config: { enabled: true, graphApiVersion: 'latest' },
      recipient: '584121234567',
      orderCode: 'NM-0012',
      consented: true,
      optedOut: false,
      templateApproved: true,
      templateName: 'order_status_update',
      languageCode: 'es_VE',
      fetcher,
    })

    expect(result.errorCode).toBe('not_configured')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('bloquea plantillas hasta que se confirme su aprobación en Meta', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(successResponse())
    const result = await sendWhatsAppApprovedOrderTemplate({
      config: CONFIG,
      recipient: '584121234567',
      orderCode: 'NM-0012',
      consented: true,
      optedOut: false,
      templateApproved: false,
      templateName: 'order_status_update',
      languageCode: 'es_VE',
      fetcher,
    })

    expect(result.errorCode).toBe('approved_template_not_confirmed')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
