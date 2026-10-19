/**
 * Traducción de los nombres de color del catálogo a valores usados por la
 * interfaz. Vive fuera del dominio porque es una decisión de presentación:
 * mañana el color puede venir con su propio hex desde Supabase.
 */

const COLOR_HEX: Readonly<Record<string, string>> = {
  Blanco: '#f2ede4',
  Arena: '#d8c3a3',
  Negro: '#211d1a',
  Celeste: '#b9d0e2',
  Gris: '#a8a29e',
  'Azul marino': '#2e4057',
  Terracota: '#b45f3c',
  Oliva: '#77764a',
  Floral: '#d9a39c',
  Khaki: '#b8a17b',
  Beige: '#d9c8ae',
  'Azul medio': '#4a6b8a',
  'Azul cielo': '#a9c9dd',
}

const FALLBACK_COLOR = '#b08968'

const LIGHT_COLORS = new Set(['Blanco', 'Arena', 'Beige', 'Celeste', 'Azul cielo', 'Floral'])

export function colorToHex(color: string): string {
  return COLOR_HEX[color] ?? FALLBACK_COLOR
}

/** Los colores claros necesitan un contorno para no desaparecer sobre papel. */
export function isLightColor(color: string): boolean {
  return LIGHT_COLORS.has(color)
}
