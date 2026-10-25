import { useState } from 'react'

import { parsePagoMovilDetails, PAGO_MOVIL_RATE_NOTICE } from '@/config/pagoMovil'

export function PagoMovilDetails({
  instructions,
  showRateNotice = true,
}: {
  readonly instructions: string
  readonly showRateNotice?: boolean
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [copyError, setCopyError] = useState('')
  const details = parsePagoMovilDetails(instructions)

  async function copyValue(key: string, value: string): Promise<void> {
    setCopyError('')
    try {
      const clipboard = Reflect.get(navigator, 'clipboard') as Clipboard | undefined
      if (!clipboard?.writeText) throw new Error('clipboard unavailable')
      await clipboard.writeText(value)
      setCopiedKey(key)
    } catch {
      setCopiedKey(null)
      setCopyError('No se pudo copiar. Selecciona y copia el dato manualmente.')
    }
  }

  return (
    <section
      aria-labelledby="pago-movil-details-title"
      className="mt-3 rounded-xl bg-paper p-3 text-sm leading-relaxed text-stone-700"
    >
      <h3 id="pago-movil-details-title" className="text-xs font-semibold tracking-wide uppercase">
        Datos para Pago Móvil
      </h3>
      <dl className="mt-2 grid gap-2">
        {details?.map((detail) => (
          <div
            key={detail.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 p-2"
          >
            <div>
              <dt className="text-xs text-stone-500">{detail.label}</dt>
              <dd className="font-medium text-ink">{detail.value}</dd>
            </div>
            <button
              type="button"
              aria-label={`Copiar ${detail.label}`}
              onClick={() => void copyValue(detail.key, detail.value)}
              className="min-h-9 rounded-full bg-white px-3 text-xs ring-1 ring-stone-900/15 hover:bg-stone-50"
            >
              {copiedKey === detail.key ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        ))}
      </dl>
      {!details ? (
        <p role="alert" className="mt-2 text-xs text-red-800">
          La tienda aún no ha configurado todos los datos públicos de Pago Móvil.
        </p>
      ) : null}
      {copiedKey ? (
        <p role="status" className="mt-2 text-xs">
          Dato copiado.
        </p>
      ) : null}
      {copyError ? (
        <p role="alert" className="mt-2 text-xs text-red-800">
          {copyError}
        </p>
      ) : null}
      {showRateNotice ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
          {PAGO_MOVIL_RATE_NOTICE}
        </p>
      ) : null}
    </section>
  )
}
