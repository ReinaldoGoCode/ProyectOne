import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  GROQ_FREE_MODEL_IDS,
  requestWhatsAppIntentHint,
  type WhatsAppIntentProviderConfig,
} from '@/lib/whatsappAiIntent'

const CONFIG: WhatsAppIntentProviderConfig = {
  enabled: true,
  freeTierConfirmed: true,
  privacyControlsConfirmed: true,
  provider: 'groq',
  apiKey: 'test-only-key',
  model: 'openai/gpt-oss-20b',
}
const HOOKS = { reserveRequest: vi.fn(() => Promise.resolve('allowed' as const)) }
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

beforeEach(() => HOOKS.reserveRequest.mockClear())

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function validResponse(content: unknown): Response {
  return jsonResponse({ choices: [{ message: { content: JSON.stringify(content) } }] })
}

describe('adaptador de intención gratuito de WhatsApp', () => {
  it('usa un modelo actualmente incluido en el plan gratuito de Groq', () => {
    expect(GROQ_FREE_MODEL_IDS).toContain('openai/gpt-oss-20b')
  })

  it('no llama si la IA está apagada, no se confirma el plan gratuito o falta la configuración', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const disabledConfigs: WhatsAppIntentProviderConfig[] = [
      { ...CONFIG, enabled: false },
      { ...CONFIG, freeTierConfirmed: false },
      { ...CONFIG, privacyControlsConfirmed: false },
      { ...CONFIG, apiKey: '' },
      Object.fromEntries(
        Object.entries(CONFIG).filter(([key]) => key !== 'model'),
      ) as WhatsAppIntentProviderConfig,
      Object.fromEntries(
        Object.entries(CONFIG).filter(([key]) => key !== 'provider'),
      ) as WhatsAppIntentProviderConfig,
    ]

    for (const config of disabledConfigs) {
      const result = await requestWhatsAppIntentHint({
        config,
        hooks: HOOKS,
        text: 'Busco una camisa de lino',
        fetcher,
      })
      expect(result).toBeNull()
    }
    expect(fetcher).not.toHaveBeenCalled()
    expect(HOOKS.reserveRequest).not.toHaveBeenCalled()
  })

  it('rechaza otro proveedor o un modelo no permitido antes de reservar cuota o hacer red', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const wrongProvider = await requestWhatsAppIntentHint({
      config: { ...CONFIG, provider: 'openai' },
      hooks: HOOKS,
      text: 'Busco una camisa',
      fetcher,
    })
    const paidOrUnknownModel = await requestWhatsAppIntentHint({
      config: { ...CONFIG, model: 'llama-3.3-70b-versatile' },
      hooks: HOOKS,
      text: 'Busco una camisa',
      fetcher,
    })

    expect(wrongProvider).toBeNull()
    expect(paidOrUnknownModel).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
    expect(HOOKS.reserveRequest).not.toHaveBeenCalled()
  })

  it('reserva la cuota y envía solo el texto mínimo al endpoint fijo de Groq', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      validResponse({
        intent: 'product_question',
        searchQuery: 'camisa de lino',
        size: 'M',
        quantity: 2,
        reply: 'Cuesta $1 y quedan 3 unidades',
        paymentReference: '12345',
      }),
    )
    const result = await requestWhatsAppIntentHint({
      config: CONFIG,
      hooks: HOOKS,
      text: 'Tienes camiza de lino talla M y quiero dos?',
      fetcher,
    })

    expect(result).toEqual({
      intent: 'product_question',
      searchQuery: 'camisa de lino',
      size: 'M',
      quantity: 2,
    })
    expect(HOOKS.reserveRequest).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [endpoint, request] = fetcher.mock.calls[0] ?? []
    expect(endpoint).toBe(GROQ_URL)
    expect(typeof request?.body).toBe('string')
    const body: unknown = JSON.parse(request?.body as string)
    expect(body).toMatchObject({ model: 'openai/gpt-oss-20b', max_tokens: 128 })
    expect(JSON.stringify(body)).toContain('Tienes camiza de lino talla M y quiero dos?')
    expect(JSON.stringify(body)).not.toContain('context')
    expect(JSON.stringify(body)).not.toContain('reply')
    expect(JSON.stringify(body)).not.toContain('paymentReference')
    expect(JSON.stringify(body)).not.toContain('test-only-key')
  })

  it.each([
    'Ya transferí, mi referencia es 123456 para el pedido NM-0012',
    'Mi correo es reina@example.com, tienes vestidos?',
    'Mi teléfono es +58 412 123 4567 y busco una camisa',
    'Envíalo a mi dirección, vivo en la avenida Libertador, piso 4',
    'Hola, soy Ana y vivo en Casa 4, Urb. Central',
    'Tengo pago móvil pendiente; mi cuenta bancaria es 123456789',
  ])('no envía al modelo datos privados o de pedidos/pagos (%s)', async (text) => {
    const fetcher = vi.fn<typeof fetch>()
    const result = await requestWhatsAppIntentHint({
      config: CONFIG,
      hooks: HOOKS,
      text,
      fetcher,
    })

    expect(result).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
    expect(HOOKS.reserveRequest).not.toHaveBeenCalled()
  })

  it('no trunca mensajes largos para evitar enviar una parte con datos sensibles al final', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const result = await requestWhatsAppIntentHint({
      config: CONFIG,
      hooks: HOOKS,
      text: `${'Busco una camisa '.repeat(30)} correo reina@example.com`,
      fetcher,
    })

    expect(result).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('si la cuota local está llena o no se puede comprobar, continúa sin llamar a Groq', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const onEvent = vi.fn()
    const limited = await requestWhatsAppIntentHint({
      config: CONFIG,
      hooks: { reserveRequest: () => Promise.resolve('limit_reached' as const), onEvent },
      text: 'Busco una camisa',
      fetcher,
    })
    const unavailable = await requestWhatsAppIntentHint({
      config: CONFIG,
      hooks: { reserveRequest: () => Promise.resolve('unavailable' as const), onEvent },
      text: 'Busco una camisa',
      fetcher,
    })

    expect(limited).toBeNull()
    expect(unavailable).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
    expect(onEvent).toHaveBeenNthCalledWith(1, 'usage_limited')
    expect(onEvent).toHaveBeenNthCalledWith(2, 'provider_error')
  })

  it('permite configurar tokens pero los mantiene dentro del máximo conservador', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(validResponse({ intent: 'unknown' }))
    await requestWhatsAppIntentHint({
      config: { ...CONFIG, maxCompletionTokens: 999 },
      hooks: HOOKS,
      text: 'Busco ropa',
      fetcher,
    })

    const [, request] = fetcher.mock.calls[0] ?? []
    const body = JSON.parse(request?.body as string) as { readonly max_tokens: number }
    expect(body.max_tokens).toBe(256)
  })

  it('trata el HTTP 429 con un solo intento, registra un código seguro y no el error remoto', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('private upstream body', { status: 429 }))
    const onEvent = vi.fn()
    const result = await requestWhatsAppIntentHint({
      config: CONFIG,
      hooks: { ...HOOKS, onEvent },
      text: 'Busco una camisa',
      fetcher,
    })

    expect(result).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith('quota_limited')
  })

  it('no deja que el modelo solicite derivación o retiro de consentimiento ni amplíe cantidades', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        validResponse({ intent: 'human_requested', quantity: 100, size: 'fuera de catálogo' }),
      )
    const result = await requestWhatsAppIntentHint({
      config: CONFIG,
      hooks: HOOKS,
      text: 'Quiero algo para una fiesta',
      fetcher,
    })

    expect(result).toEqual({ size: 'fuera de catálogo' })
  })
})
