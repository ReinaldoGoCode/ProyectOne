const STEPS = [
  {
    title: 'Elige talla y color',
    body: 'Cada prenda muestra las combinaciones que existen y el stock real, sin sorpresas al confirmar.',
  },
  {
    title: 'Deja tus datos',
    body: 'Nombre, teléfono y dirección. Sin crear cuenta ni recordar contraseñas.',
  },
  {
    title: 'Coordinamos el pago',
    body: 'Pago Móvil, transferencia o efectivo. Retiro en tienda o envío por agencia.',
  },
] as const

export function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-24 border-t border-stone-900/6">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="max-w-xl">
          <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
            El proceso
          </p>
          <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
            Tres pasos, sin fricción.
          </h2>
        </div>

        <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-t border-stone-900/10 pt-6">
              <span className="text-[11px] font-medium tracking-[0.16em] text-brand-700 tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-3 text-lg font-medium tracking-tight">{step.title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone-600">{step.body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-14 max-w-xl text-xs leading-relaxed text-stone-500">
          Sin integraciones automáticas: la verificación del pago y la coordinación del envío son
          manuales, como en el mostrador.
        </p>
      </div>
    </section>
  )
}
