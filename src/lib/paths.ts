/**
 * Base pública del sitio con barra final: `/` en desarrollo y
 * `/ProyectOne/` en GitHub Pages. Sirve para construir enlaces que
 * funcionan igual en ambos entornos.
 */
export const BASE_PATH = import.meta.env.BASE_URL

/** Enlace a una sección de la portada que funciona desde cualquier ruta. */
export function sectionHref(id: string): string {
  return `${BASE_PATH}#${id}`
}
