import { requireAdmin } from '../_shared/admin.ts'
import { corsHeaders, isAllowedOrigin, json } from '../_shared/http.ts'

const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, 405, { error: 'Method not allowed.' })
  if (!isAllowedOrigin(request)) return json(request, 403, { error: 'Origin not allowed.' })

  try {
    const admin = await requireAdmin(request)
    if (!admin) return json(request, 401, { error: 'Se requiere una cuenta autorizada.' })
    const form = await request.formData()
    const productId = form.get('productId')
    const file = form.get('image')
    if (typeof productId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productId)) {
      return json(request, 400, { error: 'Producto no válido.' })
    }
    if (!(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024) {
      return json(request, 413, { error: 'La imagen debe pesar hasta 5 MB.' })
    }
    const extension = MIME_EXTENSIONS[file.type]
    if (!extension) {
      return json(request, 415, { error: 'Usa una imagen JPG, PNG o WebP.' })
    }
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
    if (!matchesImageSignature(file.type, bytes)) {
      return json(request, 415, { error: 'El contenido del archivo no coincide con su formato.' })
    }

    const { data: product, error: productError } = await admin.service
      .from('products')
      .select('id, name')
      .eq('id', productId)
      .maybeSingle()
    if (productError || !product)
      return json(request, 404, { error: 'No se encontró el producto.' })

    const path = `${productId}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await admin.service.storage
      .from('product-images')
      .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
    if (uploadError) {
      console.error('admin-product-image upload failed', { message: uploadError.message })
      return json(request, 503, { error: 'No se pudo guardar la imagen.' })
    }

    const { data: publicUrl } = admin.service.storage.from('product-images').getPublicUrl(path)
    const imageAlt = `${product.name}: imagen cargada para la tienda.`
    const { error: updateError } = await admin.service
      .from('products')
      .update({ image_url: publicUrl.publicUrl, image_alt: imageAlt })
      .eq('id', productId)
    if (updateError) {
      await admin.service.storage.from('product-images').remove([path])
      console.error('admin-product-image update failed', { code: updateError.code })
      return json(request, 503, {
        error: 'La imagen se subió, pero no se pudo asociar al producto.',
      })
    }
    return json(request, 200, { imageUrl: publicUrl.publicUrl, imageAlt })
  } catch {
    return json(request, 400, { error: 'No se pudo procesar la imagen.' })
  }
})

function matchesImageSignature(type: string, bytes: Uint8Array): boolean {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (type === 'image/png') {
    return (
      bytes.length >= 8 &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)
    )
  }
  if (type === 'image/webp') {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    )
  }
  return false
}
