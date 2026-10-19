const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium tracking-tight transition-[background-color,color,box-shadow,transform] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:scale-[0.97]'

const VARIANTS = {
  primary: 'bg-ink text-paper shadow-[0_1px_2px_rgba(28,25,23,0.24)] hover:bg-brand-900',
  secondary:
    'bg-white/60 text-ink ring-1 ring-inset ring-stone-900/10 backdrop-blur hover:bg-white hover:ring-stone-900/20',
} as const

export type ButtonVariant = keyof typeof VARIANTS

/**
 * Clases compartidas por enlaces y botones con apariencia de acción.
 * Se usa una función y no un componente para no imponer el elemento HTML:
 * un CTA puede ser `<a>`, `<Link>` o `<button>` sin duplicar estilos.
 */
export function buttonClassName(variant: ButtonVariant = 'primary', extra?: string): string {
  return [BASE, VARIANTS[variant], extra].filter(Boolean).join(' ')
}
