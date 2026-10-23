import { describe, expect, it } from 'vitest'

import {
  parseRemoteAdminDashboardSummary,
  parseRemoteAdminPaymentMethod,
  parseRemoteCatalog,
  parseRemotePaymentReferenceResult,
  parseRemoteStorePaymentOption,
  parseRemoteWhatsAppPurchaseContext,
} from './remoteOrderGateway'

const dashboardSummary = {
  period: { from: '2026-10-01', to: '2026-10-21' },
  ordersReceived: 8,
  confirmedSalesCount: 3,
  confirmedSalesCents: '10500',
  pendingPaymentCount: 2,
  pendingPaymentCents: 7000,
  paidBalanceCents: 10500,
  pendingBalanceCents: 7000,
  preparationBacklogCount: 1,
  activeProductCount: 12,
  availableVariantCount: 28,
  lowStockVariantCount: 2,
  lowStockVariants: [
    {
      variantId: 'vestido-midi-negro-s',
      sku: 'NM-VES-001-S',
      productName: 'Vestido midi',
      size: 'S',
      color: 'Negro',
      stock: 1,
    },
  ],
  topSellers: [
    { productId: 'vestido-midi', productName: 'Vestido midi', quantity: 3, revenueCents: '10500' },
  ],
}

const remoteCatalog = {
  categories: [{ id: 'camisas', slug: 'camisas', name: 'Camisas', description: 'Ropa superior.' }],
  products: [
    {
      id: 'camisa-lino',
      slug: 'camisa-lino',
      name: 'Camisa de lino',
      category_id: 'camisas',
      description: 'Camisa de prueba.',
      composition: 'Lino.',
      care: 'Lavar en frío.',
      price_cents: 2800,
      image_url: '/images/products/placeholder.svg',
      image_alt: 'Imagen de referencia.',
      active: true,
      created_at: '2026-10-20T15:00:00.000Z',
    },
  ],
  variants: [
    {
      id: 'camisa-lino-blanco-s',
      product_id: 'camisa-lino',
      size: 'S',
      color: 'Blanco',
      sku: 'NM-CAM-001-S',
      stock: 8,
    },
  ],
}

describe('parseRemoteCatalog', () => {
  it('maps Supabase rows into the store catalog shape', () => {
    expect(parseRemoteCatalog(remoteCatalog)).toEqual({
      categories: remoteCatalog.categories,
      products: [
        {
          id: 'camisa-lino',
          slug: 'camisa-lino',
          name: 'Camisa de lino',
          categoryId: 'camisas',
          description: 'Camisa de prueba.',
          composition: 'Lino.',
          care: 'Lavar en frío.',
          priceCents: 2800,
          imageUrl: '/images/products/placeholder.svg',
          imageAlt: 'Imagen de referencia.',
          active: true,
          createdAt: '2026-10-20T15:00:00.000Z',
        },
      ],
      variants: [
        {
          id: 'camisa-lino-blanco-s',
          productId: 'camisa-lino',
          size: 'S',
          color: 'Blanco',
          sku: 'NM-CAM-001-S',
          stock: 8,
        },
      ],
    })
  })

  it('rejects invalid rows and duplicate SKU values', () => {
    expect(
      parseRemoteCatalog({
        ...remoteCatalog,
        variants: [{ ...remoteCatalog.variants[0], stock: -1 }],
      }),
    ).toBeNull()
    expect(
      parseRemoteCatalog({
        ...remoteCatalog,
        variants: [
          remoteCatalog.variants[0],
          { ...remoteCatalog.variants[0], id: 'second-variant' },
        ],
      }),
    ).toBeNull()
  })
})

describe('parseRemoteWhatsAppPurchaseContext', () => {
  const context = {
    reference: `NM-C-${'a'.repeat(64)}`,
    // Dynamic future date: a fixed timestamp turns this test into a time bomb.
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    prefilledMessage: 'Hola, quiero consultar esta compra.',
    whatsappUrl: 'https://wa.me/584121234567?text=hola',
    product: {
      slug: 'camisa-lino',
      name: 'Camisa de lino',
      size: 'M',
      color: 'Arena',
      quantity: 2,
      unitPriceCents: 2800,
      stock: 4,
    },
  }

  it('acepta contexto acotado que procede de la función segura', () => {
    expect(parseRemoteWhatsAppPurchaseContext(context)).toEqual(context)
  })

  it('rechaza una referencia mal formada y URL externa', () => {
    expect(
      parseRemoteWhatsAppPurchaseContext({
        ...context,
        whatsappUrl: 'https://example.com',
      }),
    ).toBeNull()
    expect(
      parseRemoteWhatsAppPurchaseContext({
        ...context,
        reference: 'NM-C-not-a-token',
      }),
    ).toBeNull()
  })
})

describe('parseRemotePaymentReferenceResult', () => {
  const result = {
    paymentStatus: 'review',
    reference: 'REF-12345',
    submittedAt: '2026-10-22T10:00:00.000Z',
    alreadySubmitted: false,
    alreadyVerified: false,
  }

  it('acepta la respuesta de la función de referencia', () => {
    expect(parseRemotePaymentReferenceResult(result)).toEqual(result)
  })

  it('rechaza estados y marcas que no sean del tipo esperado', () => {
    expect(parseRemotePaymentReferenceResult({ ...result, alreadySubmitted: 'yes' })).toBeNull()
    expect(parseRemotePaymentReferenceResult({ ...result, reference: 12345 })).toBeNull()
  })
})

describe('parseRemoteAdminDashboardSummary', () => {
  it('acepta métricas agregadas por el backend y enteros de Postgres como texto', () => {
    expect(parseRemoteAdminDashboardSummary(dashboardSummary)).toEqual({
      ...dashboardSummary,
      confirmedSalesCents: 10500,
      topSellers: [
        {
          productId: 'vestido-midi',
          productName: 'Vestido midi',
          quantity: 3,
          revenueCents: 10500,
        },
      ],
    })
  })

  it('rechaza métricas incompletas, montos no enteros e inventario fuera del umbral declarado', () => {
    expect(parseRemoteAdminDashboardSummary({ ...dashboardSummary, ordersReceived: -1 })).toBeNull()
    expect(
      parseRemoteAdminDashboardSummary({ ...dashboardSummary, confirmedSalesCents: '10.5' }),
    ).toBeNull()
    expect(
      parseRemoteAdminDashboardSummary({
        ...dashboardSummary,
        lowStockVariants: [{ ...dashboardSummary.lowStockVariants[0], stock: 4 }],
      }),
    ).toBeNull()
    expect(
      parseRemoteAdminDashboardSummary({ ...dashboardSummary, topSellers: [{ productName: 'X' }] }),
    ).toBeNull()
  })
})

describe('opciones de pago remotas', () => {
  it('acepta únicamente opciones manuales públicas bien formadas', () => {
    expect(
      parseRemoteStorePaymentOption({
        method: 'pago_movil',
        label: 'Pago Móvil',
        instructions: 'Instrucciones públicas del comercio.',
      }),
    ).toEqual({
      method: 'pago_movil',
      label: 'Pago Móvil',
      instructions: 'Instrucciones públicas del comercio.',
    })
    expect(
      parseRemoteStorePaymentOption({ method: 'paypal', label: 'PayPal', instructions: 'Listo.' }),
    ).toBeNull()
  })

  it('lee respuestas administrativas camelCase y snake_case sin activar un proveedor', () => {
    expect(
      parseRemoteAdminPaymentMethod({
        method: 'paypal',
        label: 'PayPal',
        kind: 'provider',
        active: false,
        instructions: '',
        providerReady: false,
      }),
    ).toMatchObject({ method: 'paypal', active: false, providerReady: false })
  })
})
