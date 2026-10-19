import { useEffect, useId, useState } from 'react'

import { buildWhatsAppUrl } from '@/lib/whatsapp'

import { buttonClassName } from './button'

type CopyStatus = 'idle' | 'copied' | 'error'

interface WhatsAppActionsProps {
  readonly message: string
  readonly label: string
  readonly disabled?: boolean
  readonly disabledLabel?: string
}

function ChatIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-8.4 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.6a8.4 8.4 0 1 1 16.1-3.9Z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </svg>
  )
}

/**
 * Copia con la API del portapapeles. Si el navegador la bloquea, la interfaz
 * muestra el mensaje en un campo de solo lectura para copiarlo a mano.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Acciones de WhatsApp reutilizables en producto, confirmación y seguimiento.
 * Recibe el mensaje ya construido: la lógica del texto vive en `lib/whatsapp`.
 */
export function WhatsAppActions({
  message,
  label,
  disabled = false,
  disabledLabel = 'No disponible',
}: WhatsAppActionsProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [showManualCopy, setShowManualCopy] = useState(false)
  const messageId = useId()

  useEffect(() => {
    if (copyStatus !== 'copied') {
      return
    }

    const timer = window.setTimeout(() => {
      setCopyStatus('idle')
    }, 2600)

    return () => {
      window.clearTimeout(timer)
    }
  }, [copyStatus])

  async function copyMessage(): Promise<void> {
    const copied = await copyText(message)

    if (copied) {
      setCopyStatus('copied')
      setShowManualCopy(false)
    } else {
      setCopyStatus('error')
      setShowManualCopy(true)
    }
  }

  const feedback =
    copyStatus === 'copied'
      ? 'Mensaje copiado al portapapeles.'
      : copyStatus === 'error'
        ? 'No se pudo copiar. Selecciona el mensaje y cópialo manualmente.'
        : ''

  if (disabled) {
    return (
      <div>
        <button
          type="button"
          disabled
          className={buttonClassName('primary', 'w-full cursor-not-allowed opacity-40')}
        >
          <ChatIcon />
          {disabledLabel}
        </button>
        <p className="mt-3 text-center text-xs text-stone-500">
          No hay stock disponible en este momento.
        </p>
      </div>
    )
  }

  return (
    <div>
      <a
        href={buildWhatsAppUrl(message)}
        target="_blank"
        rel="noreferrer noopener"
        className={buttonClassName('primary', 'w-full')}
      >
        <ChatIcon />
        {label}
        <span className="sr-only"> (se abre en una pestaña nueva)</span>
      </a>

      <button
        type="button"
        onClick={() => {
          void copyMessage()
        }}
        className={buttonClassName('secondary', 'mt-3 w-full')}
      >
        <CopyIcon />
        {copyStatus === 'copied' ? 'Mensaje copiado' : 'Copiar mensaje'}
      </button>

      <p aria-live="polite" className="mt-2 min-h-4 text-center text-xs text-stone-500">
        {feedback}
      </p>

      {showManualCopy ? (
        <div className="mt-2">
          <label
            htmlFor={messageId}
            className="text-[11px] tracking-[0.14em] text-stone-500 uppercase"
          >
            Mensaje para copiar
          </label>
          <textarea
            id={messageId}
            readOnly
            value={message}
            rows={6}
            onFocus={(event) => {
              event.currentTarget.select()
            }}
            className="mt-2 w-full resize-none rounded-xl bg-white/70 p-3 font-mono text-[11px] leading-relaxed text-stone-700 ring-1 ring-stone-900/10"
          />
        </div>
      ) : null}
    </div>
  )
}
