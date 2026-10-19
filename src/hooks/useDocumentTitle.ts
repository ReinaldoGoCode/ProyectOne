import { useEffect } from 'react'

/**
 * Asigna el título del documento a la vista actual. Sin cleanup: cada ruta
 * declara el suyo y evita restaurar un título viejo al navegar.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title
  }, [title])
}
