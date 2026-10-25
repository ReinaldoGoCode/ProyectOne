import { describe, expect, it } from 'vitest'

import {
  parseRemoteAdminDashboardSummary,
  parseRemoteAdminPaymentMethod,
  parseRemoteCatalog,
  parseRemotePaymentReferenceResult,
  parseRemotePublicOrder,
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
    amountMatches: null,
  }

  it('acepta la respuesta de la función de referencia', () => {
    expect(parseRemotePaymentReferenceResult(result)).toEqual(result)
  })

  it('rechaza estados y marcas que no sean del tipo esperado', () => {
    expect(parseRemotePaymentReferenceResult({ ...result, alreadySubmitted: 'yes' })).toBeNull()
    expect(parseRemotePaymentReferenceResult({ ...result, reference: 12345 })).toBeNull()
  })
})

describe('parseRemotePublicOrder', () => {
  it('acepta las marcas de tiempo UTC con offset que devuelve Postgres', () => {
    const order = parseRemotePublicOrder({
      id: 'order-test',
      code: 'NM-0002',
      createdAt: '2026-10-25T18:11:11.289335+00:00',
      customer: { firstName: 'Prueba', lastName: 'Netlify', phone: '0000000000', email: null },
      deliveryMethod: 'retiro',
      shippingAddress: null,
      shippingAgency: null,
      shippingCompany: null,
      shippingTrackingNumber: null,
      shippingNotes: null,
      paymentMethod: 'pago_movil',
      paymentInstructions: '',
      paymentReference: null,
      customerNote: 'PRUEBA TÉCNICA. Sin pago, no contactar.',
      subtotalCents: 2600,
      shippingCents: 0,
      totalCents: 2600,
      orderStatus: 'awaiting_payment',
      paymentStatus: 'pending',
      fulfillmentStatus: 'new',
      items: [
        {
          productId: 'demo-product',
          variantId: 'demo-variant',
          productName: 'DEMO · Blusa satinada',
          size: 'L',
          color: 'Marfil',
          unitPriceCents: 2600,
          quantity: 1,
        },
      ],
      history: [
        {
          id: 'payment-event',
          axis: 'payment',
          from: null,
          to: 'pending',
          at: '2026-10-25T18:11:11.289335+00:00',
          note: null,
        },
        {
          id: 'order-event',
          axis: 'order',
          from: null,
          to: 'awaiting_payment',
          at: '2026-10-25T18:11:11.289335+00:00',
          note: null,
        },
        {
          id: 'fulfillment-event',
          axis: 'fulfillment',
          from: null,
          to: 'new',
          at: '2026-10-25T18:11:11.289335+00:00',
          note: null,
        },
      ],
      notes: [],
      exchangeQuote: {
        vesPerUsd: '887.302000',
        source: 'bcv',
        quotedAt: '2026-10-25T18:11:11.289335+00:00',
        expiresAt: '2026-10-25T18:26:11.289335+00:00',
        effectiveDate: '2026-10-27',
        sourceUrl: 'https://rates.dolarvzla.com/bcv/current.json',
        retrievedAt: '2026-10-25T18:00:04.008629+00:00',
      },
    })

    expect(order).not.toBeNull()
    expect(order?.exchangeQuote?.quotedAt).toBe('2026-10-25T18:11:11.289335+00:00')
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
