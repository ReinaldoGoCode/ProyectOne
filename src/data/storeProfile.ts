export interface StoreLink {
  readonly label: string
  readonly href: string
}

/** Central place for optional business information. Empty values stay hidden in the storefront. */
export const STORE_PROFILE = {
  name: 'Norte Moda',
  description:
    'Una tienda conceptual de ropa con tallas, colores y variantes organizados con claridad.',
  supportEmail: null as string | null,
  socialLinks: [] as readonly StoreLink[],
  policyLinks: [] as readonly StoreLink[],
} as const
