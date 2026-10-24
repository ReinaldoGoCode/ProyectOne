import { requireAdmin } from '../_shared/admin.ts'
import { corsHeaders, isAllowedOrigin, json } from '../_shared/http.ts'

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único']

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (!['GET', 'POST'].includes(request.method)) {
    return json(request, 405, { error: 'Method not allowed.' })
  }
  if (!isAllowedOrigin(request)) return json(request, 403, { error: 'Origin not allowed.' })

  try {
    const admin = await requireAdmin(request)
    if (!admin) return json(request, 401, { error: 'Se requiere una cuenta autorizada.' })

    if (request.method === 'GET') {
      const [categories, products, variants, movements] = await Promise.all([
        admin.service.from('categories').select('id, slug, name, description').order('name'),
        admin.service
          .from('products')
          .select(
            'id, slug, name, category_id, description, composition, care, price_cents, image_url, image_alt, active, created_at',
          )
          .order('name')
          .limit(5000),
        admin.service
          .from('variants')
          .select('id, product_id, size, color, sku, stock')
          .order('sku')
          .limit(5000),
        admin.service
          .from('inventory_movements')
          .select(
            'id, variant_id, sku, product_name, size, color, delta, reason, note, order_id, created_at',
          )
          .order('created_at', { ascending: false })
          .limit(500),
      ])
      const failure = categories.error ?? products.error ?? variants.error ?? movements.error
      if (failure) {
        console.error('admin-catalog read failed', { code: failure.code })
        return json(request, 503, { error: 'No se pudo cargar el catálogo remoto.' })
      }
      return json(request, 200, {
        categories: categories.data ?? [],
        products: products.data ?? [],
        variants: variants.data ?? [],
        movements: movements.data ?? [],
      })
    }

    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > 2_000_000) {
      return json(request, 413, { error: 'El archivo supera el tamaño permitido.' })
    }
    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return json(request, 400, { error: 'El cuerpo no es un JSON válido.' })
    }
    if (isRecord(body) && body.action === 'stock') {
      if (
        typeof body.variantId !== 'string' ||
        !['set', 'add', 'subtract'].includes(String(body.mode)) ||
        !Number.isSafeInteger(body.quantity) ||
        Number(body.quantity) < 0 ||
        Number(body.quantity) > 999999999 ||
        (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 300))
      ) {
        return json(request, 400, { error: 'El ajuste de existencias no es válido.' })
      }
      const { data, error } = await admin.service.rpc('admin_adjust_variant_stock', {
        p_actor_user_id: admin.userId,
        p_variant_id: body.variantId,
        p_mode: body.mode,
        p_quantity: body.quantity,
        p_note: body.note ?? null,
      })
      if (error) {
        if (error.code === 'P0001') {
          return json(request, 409, { error: 'La salida supera las existencias disponibles.' })
        }
        if (error.code === 'P0002') {
          return json(request, 404, { error: 'No se encontró esa variante.' })
        }
        if (error.code === '22023') {
          return json(request, 400, { error: 'El servidor rechazó el ajuste de existencias.' })
        }
        if (error.code === '42501') {
          return json(request, 403, {
            error: 'La sesión no tiene permisos para ajustar existencias.',
          })
        }
        console.error('admin-catalog stock adjustment failed', { code: error.code })
        return json(request, 503, { error: 'No se pudieron guardar las existencias.' })
      }
      return json(request, 200, { result: data })
    }
    if (!isRecord(body) || !Array.isArray(body.products) || !Array.isArray(body.variants)) {
      return json(request, 400, { error: 'La importación no tiene un formato válido.' })
    }
    if (body.products.length > 5000 || body.variants.length > 5000) {
      return json(request, 413, { error: 'El catálogo supera el tamaño permitido.' })
    }
    if (!body.products.every(validProduct) || !body.variants.every(validVariant)) {
      return json(request, 400, { error: 'Hay productos o variantes con datos inválidos.' })
    }

    const { data, error } = await admin.service.rpc('admin_apply_catalog_import', {
      p_actor_user_id: admin.userId,
      p_products: body.products,
      p_variants: body.variants,
    })
    if (error || !data) {
      if (error?.code === '23505') return json(request, 409, { error: 'Hay un SKU duplicado.' })
      if (error?.code === '40001') {
        return json(request, 409, {
          error:
            'El inventario cambió después de la vista previa. Actualiza los datos y valida el archivo otra vez.',
        })
      }
      if (error?.code === '22023')
        return json(request, 400, { error: 'El servidor rechazó los datos de importación.' })
      console.error('admin-catalog import failed', { code: error?.code ?? 'empty_result' })
      return json(request, 503, { error: 'No se pudo aplicar la importación.' })
    }
    return json(request, 200, { result: data })
  } catch {
    return json(request, 400, { error: 'No se pudo procesar la solicitud administrativa.' })
  }
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validProduct(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.name === 'string' &&
    typeof value.categoryId === 'string' &&
    typeof value.description === 'string' &&
    typeof value.composition === 'string' &&
    typeof value.care === 'string' &&
    Number.isSafeInteger(value.priceCents) &&
    typeof value.imageUrl === 'string' &&
    typeof value.imageAlt === 'string' &&
    typeof value.active === 'boolean' &&
    typeof value.createdAt === 'string'
  )
}

function validVariant(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.productId === 'string' &&
    typeof value.size === 'string' &&
    SIZES.includes(value.size) &&
    typeof value.color === 'string' &&
    typeof value.sku === 'string' &&
    Number.isSafeInteger(value.stock) &&
    Number(value.stock) >= 0 &&
    (value.expectedStock === null ||
      (Number.isSafeInteger(value.expectedStock) && Number(value.expectedStock) >= 0))
  )
}
