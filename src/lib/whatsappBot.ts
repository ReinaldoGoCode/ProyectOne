export interface WhatsAppOrderFacts {
  readonly code: string
  readonly paymentStatus: 'pending' | 'review' | 'paid' | 'rejected' | 'cancelled'
  readonly orderStatus: 'awaiting_payment' | 'confirmed' | 'inventory_exception' | 'cancelled'
  readonly fulfillmentStatus: 'new' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'
  readonly totalCents: number
  readonly vesTotalCents: number
  readonly vesPerUsd: string
  readonly exchangeSource: 'demo_ficticia' | 'bcv'
  readonly paymentInstructions?: string | null
}

export interface WhatsAppBotReply {
  readonly message: string
  readonly referencedOrderCode: string | null
  readonly handoffReason:
    'human_requested' | 'payment_instructions_missing' | 'unknown_request' | null
}

export interface WhatsAppPurchaseContextFacts {
  readonly productSlug?: string
  readonly productUrl?: string
  readonly productName: string
  readonly size: string
  readonly color: string
  readonly quantity: number
  readonly unitPriceCents: number
  readonly stock: number
  readonly available: boolean
}

const PAYMENT_STATUS: Readonly<Record<WhatsAppOrderFacts['paymentStatus'], string>> = {
  pending: 'pendiente de revisión',
  review: 'en revisión manual',
  paid: 'aprobado por el administrador',
  rejected: 'rechazado por el administrador',
  cancelled: 'cancelado',
}

const ORDER_STATUS: Readonly<Record<WhatsAppOrderFacts['orderStatus'], string>> = {
  awaiting_payment: 'pendiente de pago',
  confirmed: 'confirmado',
  inventory_exception: 'en espera por una incidencia de inventario',
  cancelled: 'cancelado',
}

const FULFILLMENT_STATUS: Readonly<Record<WhatsAppOrderFacts['fulfillmentStatus'], string>> = {
  new: 'aún no está en preparación',
  preparing: 'en preparación',
  shipped: 'despachado',
  delivered: 'entregado',
  cancelled: 'cancelado',
}

const ORDER_CODE = /\bNM-\d{3,}\b/i
const HUMAN_REQUEST = /\b(persona|humano|humana|asesor|asesora|agente|operador|operadora)\b/i
const PAYMENT_REQUEST = /\b(pago|pagar|pago\s*m[oó]vil|transferencia|comprobante|referencia)\b/i
const ORDER_REQUEST = /\b(pedido|orden|estado|seguimiento|rastreo)\b/i
const HELP_REQUEST = /\b(hola|buenas|ayuda|men[uú]|opciones|gracias)\b/i

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

/** Replies only with current product facts verified by the purchase-context RPC. */
export function routeWhatsAppPurchaseContext(
  context: WhatsAppPurchaseContextFacts | null,
): WhatsAppBotReply {
  if (!context) {
    return {
      message:
        'No pude validar esa referencia. Puede haber vencido o estar vinculada a otro teléfono. Vuelve al sitio para generar una referencia nueva o solicita atención humana.',
      referencedOrderCode: null,
      handoffReason: null,
    }
  }

  const summary = [
    `Consulta de compra: ${context.productName}.`,
    `Talla: ${context.size}; color: ${context.color}.`,
    `Cantidad solicitada: ${String(context.quantity)}.`,
    `Precio actual: $${formatCents(context.unitPriceCents)} USD por unidad.`,
    `Stock actual: ${String(context.stock)} unidades.`,
  ]
  if (!context.available) {
    return {
      message: [
        ...summary,
        'La disponibilidad cambió y no hay unidades suficientes ahora. No se creó un pedido ni se reservó inventario. Solicita atención humana o vuelve a consultar el sitio.',
      ].join('\n'),
      referencedOrderCode: null,
      handoffReason: null,
    }
  }

  return {
    message: [
      ...summary,
      'La variante aparece disponible al momento de esta consulta, pero el inventario no está reservado.',
      context.productUrl
        ? `Puedes continuar con esta misma talla, color y cantidad desde la ficha del producto: ${context.productUrl}`
        : 'Para completar la compra, vuelve al sitio y termina el checkout con tu nombre, teléfono, forma y datos de entrega, y el método de pago manual disponible. El sitio volverá a verificar precio y stock antes de registrar el pedido.',
      'Este mensaje no creó un pedido ni confirmó un pago.',
    ].join('\n'),
    referencedOrderCode: null,
    handoffReason: null,
  }
}

/** Deterministic replies use verified order facts only and never approve payments. */
export function routeWhatsAppMessage(
  text: string,
  order: WhatsAppOrderFacts | null,
): WhatsAppBotReply {
  const message = text.trim().slice(0, 1500)
  const code = ORDER_CODE.exec(message)?.[0]?.toUpperCase() ?? null

  if (HUMAN_REQUEST.test(message)) {
    return {
      message:
        'Registré tu solicitud para atención humana. El equipo revisará el caso desde el panel; no compartas contraseñas, códigos de seguridad ni datos bancarios por este chat.',
      referencedOrderCode: code,
      handoffReason: 'human_requested',
    }
  }

  if (code && !order) {
    return {
      message:
        'No pude asociar ese código con el teléfono desde el que escribes. Revisa el código o solicita atención humana; no voy a mostrar datos de otro cliente.',
      referencedOrderCode: code,
      handoffReason: null,
    }
  }

  if (order) {
    if (PAYMENT_REQUEST.test(message)) {
      const instructions = order.paymentInstructions?.trim()
      if (instructions) {
        return {
          message: [
            `El pago de ${order.code} está ${PAYMENT_STATUS[order.paymentStatus]}.`,
            'Instrucciones guardadas con este pedido:',
            instructions,
            'Enviar instrucciones no confirma el pago. Solo lo aprueba un administrador autorizado.',
          ].join('\n'),
          referencedOrderCode: order.code,
          handoffReason: null,
        }
      }
      return {
        message: `El pago de ${order.code} está ${PAYMENT_STATUS[order.paymentStatus]}. Esta demo no tiene instrucciones de pago configuradas. Un comprobante o mensaje no aprueba el pago: solo lo confirma un administrador autorizado.`,
        referencedOrderCode: order.code,
        handoffReason: 'payment_instructions_missing',
      }
    }
    return {
      message: [
        `Pedido ${order.code}: ${ORDER_STATUS[order.orderStatus]}.`,
        `Pago: ${PAYMENT_STATUS[order.paymentStatus]}.`,
        `Entrega: ${FULFILLMENT_STATUS[order.fulfillmentStatus]}.`,
        `Total guardado: $${formatCents(order.totalCents)}; ${formatCents(order.vesTotalCents)} Bs. (${order.exchangeSource === 'bcv' ? 'BCV' : 'tasa ficticia demo'}: ${order.vesPerUsd} Bs./USD).`,
        'El pago solo se aprueba tras revisión de un administrador.',
      ].join('\n'),
      referencedOrderCode: order.code,
      handoffReason: null,
    }
  }

  if (ORDER_REQUEST.test(message)) {
    return {
      message:
        'Para consultar tu compra, envía el código de pedido (por ejemplo, NM-0001) desde el mismo teléfono usado al comprar.',
      referencedOrderCode: null,
      handoffReason: null,
    }
  }

  if (PAYMENT_REQUEST.test(message)) {
    return {
      message:
        'No hay instrucciones de pago configuradas para esta demo. No transfieras dinero ni compartas comprobantes; solicita atención humana para verificar opciones.',
      referencedOrderCode: null,
      handoffReason: 'payment_instructions_missing',
    }
  }

  if (HELP_REQUEST.test(message)) {
    return {
      message:
        'Hola, soy el asistente de Norte Moda. Puedo consultar el estado de un pedido con su código NM-XXXX. Los pagos se revisan manualmente. Si necesitas una persona, escribe “asesor”.',
      referencedOrderCode: null,
      handoffReason: null,
    }
  }

  return {
    message:
      'No tengo información suficiente para responder sin adivinar. Escribe el código NM-XXXX para consultar un pedido o solicita atención humana.',
    referencedOrderCode: null,
    handoffReason: 'unknown_request',
  }
}
