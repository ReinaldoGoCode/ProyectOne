import { useState } from 'react'

import { buttonClassName } from '@/components/ui/button'
import type { RemoteAdminPaymentMethod } from '@/data/repositories/remoteOrderGateway'

type ManualMethod = Extract<
  RemoteAdminPaymentMethod['method'],
  'pago_movil' | 'transferencia' | 'efectivo_ves' | 'efectivo_usd'
>
interface ManualDraft {
  readonly method: ManualMethod
  readonly active: boolean
  readonly instructions: string
}

function toManualDrafts(methods: readonly RemoteAdminPaymentMethod[]): ManualDraft[] {
  return methods
    .filter(
      (method): method is RemoteAdminPaymentMethod & { method: ManualMethod } =>
        method.kind === 'manual',
    )
    .map(({ method, active, instructions }) => ({ method, active, instructions }))
}

export function RemotePaymentSettingsPanel({
  methods,
  onSave,
}: {
  readonly methods: readonly RemoteAdminPaymentMethod[]
  readonly onSave: (methods: readonly ManualDraft[]) => Promise<readonly RemoteAdminPaymentMethod[]>
}) {
  const [drafts, setDrafts] = useState(() => toManualDrafts(methods))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function update<K extends 'active' | 'instructions'>(
    method: ManualMethod,
    key: K,
    value: ManualDraft[K],
  ): void {
    setDrafts((current) =>
      current.map((draft) => (draft.method === method ? { ...draft, [key]: value } : draft)),
    )
  }

  async function save(): Promise<void> {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const updated = await onSave(drafts)
      setDrafts(toManualDrafts(updated))
      setNotice('Métodos de pago guardados. Los compradores verán solo los habilitados.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar la configuración.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      id="admin-payments"
      className="mt-8 scroll-mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-stone-900/10 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-brand-700 uppercase">
            Configuración de la tienda
          </p>
          <h2 className="mt-2 text-2xl font-medium tracking-tight">Métodos de pago</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
            Todos comienzan desactivados. Activa un método manual solo cuando tengas instrucciones
            públicas listas para mostrar durante la compra.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className={buttonClassName('primary', 'disabled:opacity-50')}
        >
          {busy ? 'Guardando…' : 'Guardar métodos'}
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {drafts.map((draft) => {
          const metadata = methods.find((method) => method.method === draft.method)
          return (
            <article key={draft.method} className="rounded-2xl bg-paper/80 p-4">
              <label className="flex items-start justify-between gap-4">
                <span>
                  <span className="block font-medium">{metadata?.label ?? draft.method}</span>
                  <span className="mt-1 block text-xs text-stone-500">
                    Pago manual · aprobación posterior por una persona
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(event) => {
                    update(draft.method, 'active', event.currentTarget.checked)
                  }}
                  aria-label={`Habilitar ${metadata?.label ?? draft.method}`}
                  className="mt-1 size-5 accent-ink"
                />
              </label>
              <label className="mt-4 block text-xs font-medium text-stone-600">
                Instrucciones que verá el comprador
                <textarea
                  rows={3}
                  maxLength={500}
                  value={draft.instructions}
                  onChange={(event) => {
                    update(draft.method, 'instructions', event.currentTarget.value)
                  }}
                  placeholder="Completa solo con información pública de cobro que el negocio quiera compartir."
                  className="mt-1.5 w-full rounded-xl bg-white p-3 text-sm ring-1 ring-stone-900/12"
                />
              </label>
              {draft.active && draft.instructions.trim().length < 8 ? (
                <p className="mt-2 text-xs text-amber-900">
                  Añade instrucciones antes de habilitar este método.
                </p>
              ) : null}
            </article>
          )
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-stone-900/10 bg-white/50 p-4">
        <h3 className="font-medium">Requieren integración con proveedor</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {methods
            .filter((method) => method.kind === 'provider')
            .map((method) => (
              <div key={method.method} className="rounded-xl bg-paper/80 p-3 text-sm">
                <p className="font-medium">{method.label}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {method.providerReady
                    ? 'Integración lista'
                    : 'No disponible: faltan cuenta, credenciales y verificación del proveedor.'}
                </p>
              </div>
            ))}
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-stone-500">
        No introduzcas contraseñas, códigos OTP ni claves privadas. Esta pantalla guarda solo texto
        público para las instrucciones manuales; ninguna pasarela se simula ni se activa aquí.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p aria-live="polite" className="mt-3 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}
    </section>
  )
}
