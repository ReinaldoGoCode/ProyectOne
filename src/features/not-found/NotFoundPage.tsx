import { Link } from 'react-router-dom'

import { buttonClassName } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-5 py-24 text-center sm:px-8 sm:py-36">
      <p className="text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase">
        Error 404
      </p>
      <h1 className="mt-4 text-5xl font-medium tracking-[-0.04em] text-balance sm:text-7xl">
        Esto no está en el perchero.
      </h1>
      <p className="mt-6 max-w-md text-base leading-relaxed text-stone-600">
        La página que buscás no existe o cambió de lugar. Podés volver al inicio y seguir mirando la
        selección.
      </p>
      <Link to="/" className={buttonClassName('primary', 'mt-9')}>
        Volver al inicio
      </Link>
    </section>
  )
}
