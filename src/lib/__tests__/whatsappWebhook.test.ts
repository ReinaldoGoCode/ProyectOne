import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  deduplicateWhatsAppEvents,
  extractWhatsAppEvents,
  extractWhatsAppInboundMessages,
  hashWhatsAppPhone,
  verifyWhatsAppWebhookSignature,
} from '@/lib/whatsappWebhook'

const PAYLOAD = {
  object: 'whatsapp_business_account',
  entry: [
    {
      changes: [
        {
          value: {
            messages: [
              {
                id: 'wamid.message-1234',
                from: '584121234567',
                timestamp: '1792600000',
                type: 'text',
                text: { body: '¿Tienen la camisa en talla M?' },
              },
              {
                id: 'wamid.image-1234',
                from: '584121234567',
                timestamp: '1792600001',
                type: 'image',
                image: { caption: 'NM-0012 referencia 123456' },
              },
            ],
            statuses: [{ id: 'wamid.message-1234', status: 'delivered', timestamp: '1792600000' }],
          },
        },
      ],
    },
  ],
}

describe('webhook firmado de WhatsApp Cloud API', () => {
  it('verifica HMAC-SHA256 sobre el cuerpo original y rechaza firmas incorrectas', async () => {
    const raw = JSON.stringify(PAYLOAD)
    const body = new TextEncoder().encode(raw).buffer
    const signature = `sha256=${createHmac('sha256', 'app-secret').update(raw).digest('hex')}`

    await expect(verifyWhatsAppWebhookSignature(body, 'app-secret', signature)).resolves.toBe(true)
    await expect(verifyWhatsAppWebhookSignature(body, 'other-secret', signature)).resolves.toBe(
      false,
    )
    await expect(verifyWhatsAppWebhookSignature(body, 'app-secret', 'sha256=bad')).resolves.toBe(
      false,
    )
  })

  it('guarda el contexto con hash HMAC del teléfono, no con el número en claro', async () => {
    const hash = await hashWhatsAppPhone(
      '+58 (412) 123-4567',
      'test-secret-that-is-long-enough-123456',
    )
    const otherHash = await hashWhatsAppPhone(
      '584121234567',
      'another-test-secret-long-enough-12345',
    )

    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashWhatsAppPhone('584121234567', 'test-secret-that-is-long-enough-123456')).toBe(
      hash,
    )
    expect(otherHash).not.toBe(hash)
    await expect(
      hashWhatsAppPhone('123', 'test-secret-that-is-long-enough-123456'),
    ).rejects.toThrow()
    await expect(hashWhatsAppPhone('584121234567', 'short')).rejects.toThrow()
  })

  it('extrae eventos entrantes y recibos con claves distintas para deduplicar', () => {
    const events = extractWhatsAppEvents(PAYLOAD)

    expect(events).toEqual([
      { id: 'wamid.message-1234', type: 'incoming_message' },
      { id: 'wamid.image-1234', type: 'incoming_message' },
      {
        id: 'wamid.message-1234:delivered',
        type: 'message_status_delivered',
        providerMessageId: 'wamid.message-1234',
        status: 'delivered',
        timestamp: '2026-10-21T16:26:40.000Z',
        errorCode: null,
      },
    ])
  })

  it('colapsa eventos repetidos dentro del mismo envío del webhook', () => {
    expect(
      deduplicateWhatsAppEvents([
        { id: 'wamid.message-1234', type: 'incoming_message' },
        { id: 'wamid.message-1234', type: 'incoming_message' },
        { id: 'wamid.message-1234:delivered', type: 'message_status_delivered' },
      ]),
    ).toEqual([
      { id: 'wamid.message-1234', type: 'incoming_message' },
      { id: 'wamid.message-1234:delivered', type: 'message_status_delivered' },
    ])
  })

  it('extrae estados de error sin copiar contenido sensible del webhook', () => {
    const events = extractWhatsAppEvents({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: 'wamid.failed-1234',
                    status: 'failed',
                    timestamp: '1792600000',
                    errors: [{ code: 131026, title: 'Undeliverable recipient' }],
                  },
                ],
              },
            },
          ],
        },
      ],
    })

    expect(events[0]).toMatchObject({ status: 'failed', errorCode: 'meta_131026' })
    expect(events[0]).not.toHaveProperty('title')
  })

  it('extrae texto y leyendas breves sin guardar ni descargar el contenido de archivos', () => {
    const messages = extractWhatsAppInboundMessages(PAYLOAD)

    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({
      id: 'wamid.message-1234',
      from: '584121234567',
      text: '¿Tienen la camisa en talla M?',
      type: 'text',
      timestamp: '2026-10-21T16:26:40.000Z',
    })
    expect(messages[1]?.text).toBe('NM-0012 referencia 123456')
    expect(messages[1]?.type).toBe('image')
  })
})
