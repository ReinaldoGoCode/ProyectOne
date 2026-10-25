// Verificación de las migraciones y reglas transaccionales en PostgreSQL real
// (PGlite, PostgreSQL compilado a WebAssembly). No sustituye una prueba contra
// Supabase Cloud, pero ejecuta el SQL, las funciones y las políticas RLS.
import { readdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { PGlite } from '@electric-sql/pglite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const db = new PGlite()
let passed = 0

function ok(condition, label) {
  if (!condition) throw new Error(`FALLÓ: ${label}`)
  passed += 1
  console.log(`  ✓ ${label}`)
}

async function query(sql, params) {
  const result = await db.query(sql, params)
  return result.rows
}

async function expectError(sql, params, code, label) {
  try {
    await db.query(sql, params)
  } catch (error) {
    const actual = error?.code ?? error?.cause?.code ?? ''
    ok(actual === code, `${label} (error ${code})`)
    return
  }
  throw new Error(`FALLÓ: ${label}; no se lanzó el error ${code}`)
}

const token = 'a'.repeat(64)
const tokenHash = createHash('sha256').update(token).digest('hex')

try {
  console.log('1. Preparando esquemas que Supabase proporciona')
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid
      language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text not null
    );
    alter table storage.objects enable row level security;
  `)

  console.log('2. Aplicando migraciones en orden')
  const migrationsDir = join(root, 'supabase', 'migrations')
  const migrations = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort()
  for (const migration of migrations) {
    const sql = (await readFile(join(migrationsDir, migration), 'utf8')).replace(
      /-- BEGIN SUPABASE CLOUD ONLY[\s\S]*?-- END SUPABASE CLOUD ONLY/g,
      '',
    )
    await db.exec(sql)
    console.log(`  ✓ ${migration}`)
  }
  const seed = await readFile(join(root, 'supabase', 'seed.sql'), 'utf8')
  await db.exec(seed)
  console.log('  ✓ seed.sql')

  console.log('3. Catálogo y cotización')
  const [catalog] = await query(`
    select
      (select count(*)::int from public.products where active) as products,
      (select count(*)::int from public.variants) as variants
  `)
  ok(catalog.products === 20, `catálogo con 20 productos activos (${catalog.products})`)
  ok(catalog.variants > 20, `variantes cargadas (${catalog.variants})`)

  const [paymentConfiguration] = await query(`
    select active, public_instructions
    from public.payment_methods where method = 'pago_movil'
  `)
  ok(paymentConfiguration.active, 'Pago Móvil queda habilitado por la migración')
  ok(
    paymentConfiguration.public_instructions.includes('V-14082115') &&
      paymentConfiguration.public_instructions.includes('Banco Venezolano de Crédito') &&
      paymentConfiguration.public_instructions.includes('0412-3095646'),
    'la configuración pública conserva exactamente los datos autorizados',
  )
  const [receiptBucket] = await query(
    `select public, file_size_limit from storage.buckets where id = 'payment-receipts'`,
  )
  ok(receiptBucket.public === false, 'el bucket de comprobantes permanece privado')
  ok(receiptBucket.file_size_limit === 5242880, 'el bucket limita los archivos a 5 MB')

  await query(`
    update public.payment_methods
    set active = true,
        public_instructions = 'Pago Móvil de prueba: banco ficticio, cuenta 0000. No transferir dinero real.'
    where method = 'pago_movil'
  `)

  const [refreshClaim] = await query('select public.claim_bcv_rate_refresh() as claimed')
  ok(refreshClaim.claimed === true, 'el primer proceso puede reclamar la actualización BCV')
  const [duplicateRefreshClaim] = await query('select public.claim_bcv_rate_refresh() as claimed')
  ok(duplicateRefreshClaim.claimed === false, 'el límite impide reintentos consecutivos')
  await query(`
    select public.save_bcv_rate(
      900.123456,
      (now() at time zone 'America/Caracas')::date
    )
  `)

  const [quoteRow] = await query('select public.issue_bcv_quote() as quote')
  const quote = quoteRow.quote
  ok(
    quote?.id && quote.source === 'bcv' && quote.effectiveDate,
    'cotización BCV emitida con su fecha de vigencia',
  )
  ok(quote.rateWarning === false, 'una tasa recién guardada no muestra advertencia de antigüedad')
  ok(
    (await query(`select public.issue_demo_quote() as quote`))[0].quote?.source === 'bcv',
    'el RPC antiguo ahora delega a una cotización BCV fechada',
  )

  const [variant] = await query(`
    select v.id, v.stock, p.price_cents
    from public.variants v
    join public.products p on p.id = v.product_id
    where p.active and v.stock >= 3
    order by v.sku
    limit 1
  `)
  ok(Boolean(variant), 'variante con existencias disponible')

  await expectError(
    'select public.preview_public_order($1::jsonb, $2, $3::uuid)',
    [JSON.stringify([{ variant_id: variant.id, quantity: variant.stock + 1 }]), 'retiro', quote.id],
    'P0002',
    'rechaza una compra superior al stock disponible',
  )
  const [emptyVariant] = await query(
    'select id from public.variants where stock = 0 order by id limit 1',
  )
  ok(Boolean(emptyVariant), 'el catálogo conserva variantes agotadas por separado')
  await expectError(
    'select public.preview_public_order($1::jsonb, $2, $3::uuid)',
    [JSON.stringify([{ variant_id: emptyVariant.id, quantity: 1 }]), 'retiro', quote.id],
    'P0002',
    'rechaza una variante con stock cero',
  )

  const items = JSON.stringify([{ variant_id: variant.id, quantity: 2 }])
  const [previewRow] = await query(
    'select public.preview_public_order($1::jsonb, $2, $3::uuid) as preview',
    [items, 'retiro', quote.id],
  )
  const preview = previewRow.preview
  ok(preview.totalCents === variant.price_cents * 2, 'el servidor recalcula el total')
  ok(preview.shippingCents === 0, 'retiro sin costo de envío')
  const expectedVesTotal = Number((BigInt(preview.totalCents) * 900123456n + 500000n) / 1000000n)
  ok(
    preview.vesTotalCents === expectedVesTotal,
    'la conversión VES usa redondeo decimal preciso desde la tasa BCV guardada',
  )

  console.log('4. Creación idempotente del pedido')
  const customer = {
    firstName: 'Ana',
    lastName: 'Pérez',
    phone: '+584121234567',
    email: null,
  }
  const createArgs = [
    '11111111-1111-4111-8111-111111111111',
    tokenHash,
    JSON.stringify(customer),
    'retiro',
    null,
    null,
    'pago_movil',
    'Nota de prueba',
    items,
    quote.id,
    preview.subtotalCents,
    preview.shippingCents,
    preview.totalCents,
    preview.vesTotalCents,
  ]
  const [createdRow] = await query(
    `select public.create_public_order_v2(
      $1::uuid, $2, $3::jsonb, $4, $5::jsonb, $6, $7, $8, $9::jsonb, $10::uuid,
      $11::int, $12::int, $13::int, $14::bigint
    ) as created`,
    createArgs,
  )
  const created = createdRow.created
  ok(/^NM-\d{4,}$/.test(created.code), `pedido creado con código ${created.code}`)
  ok(created.totalCents === preview.totalCents, 'total guardado coincide con la cotización')
  ok(created.paymentStatus === 'pending', 'el pago empieza pendiente')
  const [frozenRate] = await query(
    `select exchange_rate_effective_date, exchange_rate_source_url, exchange_rate_retrieved_at
     from public.orders where id = $1::uuid`,
    [created.id],
  )
  ok(
    new Date(frozenRate.exchange_rate_effective_date).toISOString().slice(0, 10) ===
      quote.effectiveDate &&
      frozenRate.exchange_rate_source_url === 'https://rates.dolarvzla.com/bcv/current.json' &&
      frozenRate.exchange_rate_retrieved_at !== null,
    'el pedido conserva la tasa y la procedencia BCV usadas al crearlo',
  )

  const [replayedRow] = await query(
    `select public.create_public_order_v2(
      $1::uuid, $2, $3::jsonb, $4, $5::jsonb, $6, $7, $8, $9::jsonb, $10::uuid,
      $11::int, $12::int, $13::int, $14::bigint
    ) as created`,
    createArgs,
  )
  ok(
    replayedRow.created.code === created.code,
    'la misma clave idempotente devuelve el mismo pedido',
  )
  const [orderCount] = await query('select count(*)::int as count from public.orders')
  ok(orderCount.count === 1, 'no se duplicó el pedido')

  await query(`
    select public.save_bcv_rate(
      901.123456,
      (now() at time zone 'America/Caracas')::date
    )
  `)
  const [unchangedOrder] = await query(
    `select ves_per_usd, ves_total_cents, exchange_rate_effective_date
     from public.orders where id = $1::uuid`,
    [created.id],
  )
  ok(
    unchangedOrder.ves_per_usd === '900.123456' &&
      unchangedOrder.ves_total_cents === preview.vesTotalCents &&
      new Date(unchangedOrder.exchange_rate_effective_date).toISOString().slice(0, 10) ===
        quote.effectiveDate,
    'actualizar la tasa no modifica importes ni vigencia de pedidos anteriores',
  )
  await query(`select public.record_bcv_rate_failure('upstream_unavailable')`)
  const [fallbackQuote] = await query('select public.issue_bcv_quote() as quote')
  ok(
    fallbackQuote.quote?.rateWarning === true && fallbackQuote.quote?.vesPerUsd === '901.123456',
    'si el portal falla se conserva la última tasa y se etiqueta con advertencia',
  )

  await expectError(
    `select public.create_public_order_v2(
      '22222222-2222-4222-8222-222222222222'::uuid, $1, $2::jsonb, 'retiro', null, null,
      'pago_movil', null, $3::jsonb, $4::uuid, $5::int, 0, 1, $6::bigint
    )`,
    [
      tokenHash,
      JSON.stringify(customer),
      items,
      quote.id,
      preview.subtotalCents,
      preview.vesTotalCents,
    ],
    'P0001',
    'rechaza un total manipulado por el navegador',
  )

  console.log('5. Consulta privada y referencia de pago')
  const [lookupRow] = await query('select public.lookup_public_order($1, $2) as order_data', [
    created.code,
    tokenHash,
  ])
  ok(lookupRow.order_data?.code === created.code, 'el enlace privado encuentra el pedido')
  const [wrongLookup] = await query('select public.lookup_public_order($1, $2) as order_data', [
    created.code,
    'b'.repeat(64),
  ])
  ok(wrongLookup.order_data === null, 'un token incorrecto no revela el pedido')

  const adminId = '33333333-3333-4333-8333-333333333333'
  await query('insert into auth.users (id, email) values ($1::uuid, $2)', [
    adminId,
    'admin@example.test',
  ])
  await query('insert into public.admin_users (user_id) values ($1::uuid)', [adminId])

  const [referenceRow] = await query(
    'select public.submit_public_payment_reference($1, $2, $3, $4) as result',
    [created.code, tokenHash, 'REF-LEGACY', 'Referencia antigua sin comprobante'],
  )
  ok(referenceRow.result.paymentStatus === 'review', 'la referencia deja el pago en revisión')
  ok(referenceRow.result.alreadySubmitted === false, 'la primera referencia se registra')

  await expectError(
    `select public.admin_update_payment($1::uuid, 'paid', 'Sin comprobante', $2::uuid)`,
    [created.id, adminId],
    '22023',
    'bloquea la aprobación de un reporte sin monto ni comprobante',
  )

  const reportReceiptPath = '123e4567-e89b-12d3-a456-426614174000.pdf'
  const [reportRow] = await query(
    `select public.submit_public_payment_report($1, $2, $3, $4, $5, 'VES', current_date, $6) as result`,
    [created.code, tokenHash, 'REF-12345', 'Pago Móvil de prueba', 300000, reportReceiptPath],
  )
  ok(reportRow.result.paymentStatus === 'review', 'el reporte completo permanece en revisión')
  ok(
    reportRow.result.amountMatches === false,
    'la referencia se compara contra el total VES congelado',
  )
  const [storedReport] = await query(
    `select status, reported_amount_cents, reported_currency, paid_at, receipt_path
     from public.payment_attempts where order_id = $1::uuid and reference = 'REF-12345'`,
    [created.id],
  )
  ok(
    String(storedReport.reported_amount_cents) === '300000' &&
      storedReport.reported_currency === 'VES' &&
      storedReport.paid_at !== null &&
      storedReport.receipt_path === reportReceiptPath,
    'monto, moneda, fecha y comprobante quedan asociados al reporte',
  )

  const [duplicateReference] = await query(
    `select public.submit_public_payment_report($1, $2, $3, $4, $5, 'VES', current_date, $6) as result`,
    [created.code, tokenHash, 'REF-12345', '', 300000, reportReceiptPath],
  )
  ok(
    duplicateReference.result.alreadySubmitted === true,
    'reenviar la misma referencia es idempotente',
  )

  await expectError(
    `select public.submit_public_payment_report($1, $2, $3, $4, $5, 'VES', current_date, $6)`,
    [created.code, 'b'.repeat(64), 'REF-99999', '', 300000, reportReceiptPath],
    'P0002',
    'rechaza una referencia sin el token privado correcto',
  )

  const [paymentBefore] = await query(
    'select payment_status, order_status from public.orders where id = $1::uuid',
    [created.id],
  )
  ok(paymentBefore.payment_status === 'review', 'el pedido queda pendiente de revisión, no pagado')
  ok(paymentBefore.order_status === 'awaiting_payment', 'la referencia no confirma el pedido')

  console.log('6. Autorización y revisión administrativa')
  await expectError(
    `select public.admin_update_payment($1::uuid, 'paid', 'sin permiso', $2::uuid)`,
    [created.id, '44444444-4444-4444-8444-444444444444'],
    '42501',
    'un usuario sin membresía no puede aprobar pagos',
  )

  const [paidRow] = await query(
    `select public.admin_update_payment($1::uuid, 'paid', 'Verificado manualmente', $2::uuid) as result`,
    [created.id, adminId],
  )
  ok(paidRow.result.paymentStatus === 'paid', 'un administrador autorizado registra el pago')
  ok(paidRow.result.orderStatus === 'confirmed', 'el pedido se confirma al aprobar el pago')

  const [stockAfter] = await query('select stock from public.variants where id = $1', [variant.id])
  ok(stockAfter.stock === variant.stock - 2, 'el stock se descuenta una sola vez')

  console.log('6.1. Dos pedidos concurrentes sobre las mismas unidades')
  const racingQuantity = stockAfter.stock
  const raceItems = JSON.stringify([{ variant_id: variant.id, quantity: racingQuantity }])
  const [raceQuoteRow] = await query(
    'select public.preview_public_order($1::jsonb, $2, $3::uuid) as preview',
    [raceItems, 'retiro', quote.id],
  )
  const racePreview = raceQuoteRow.preview
  const raceArgs = [...createArgs]
  raceArgs[8] = raceItems
  raceArgs[9] = quote.id
  raceArgs[10] = racePreview.subtotalCents
  raceArgs[11] = racePreview.shippingCents
  raceArgs[12] = racePreview.totalCents
  raceArgs[13] = racePreview.vesTotalCents
  raceArgs[0] = '55555555-5555-4555-8555-555555555555'
  raceArgs[1] = createHash('sha256').update('competing-order-a').digest('hex')
  const [raceOrderA] = await query(
    `select public.create_public_order_v2(
      $1::uuid, $2, $3::jsonb, $4, $5::jsonb, $6, $7, $8, $9::jsonb, $10::uuid,
      $11::int, $12::int, $13::int, $14::bigint
    ) as created`,
    raceArgs,
  )
  raceArgs[0] = '66666666-6666-4666-8666-666666666666'
  raceArgs[1] = createHash('sha256').update('competing-order-b').digest('hex')
  const [raceOrderB] = await query(
    `select public.create_public_order_v2(
      $1::uuid, $2, $3::jsonb, $4, $5::jsonb, $6, $7, $8, $9::jsonb, $10::uuid,
      $11::int, $12::int, $13::int, $14::bigint
    ) as created`,
    raceArgs,
  )
  ok(
    Boolean(raceOrderA.created.id && raceOrderB.created.id),
    'dos pedidos pueden esperar revisión por las mismas unidades',
  )
  await query(
    `select public.submit_public_payment_report($1, $2, 'REF-RACE-A', '', 10000, 'VES', current_date, '123e4567-e89b-12d3-a456-426614174001.pdf')`,
    [raceOrderA.created.code, createHash('sha256').update('competing-order-a').digest('hex')],
  )
  const [racePaidA] = await query(
    `select public.admin_update_payment($1::uuid, 'paid', 'Prueba autorizada', $2::uuid) as result`,
    [raceOrderA.created.id, adminId],
  )
  ok(
    racePaidA.result.orderStatus === 'confirmed',
    'el primer pago de prueba consume las unidades disponibles',
  )
  await query(
    `select public.submit_public_payment_report($1, $2, 'REF-RACE-B1', '', 10000, 'VES', current_date, '123e4567-e89b-12d3-a456-426614174002.pdf')`,
    [raceOrderB.created.code, createHash('sha256').update('competing-order-b').digest('hex')],
  )
  await query(
    `select public.admin_update_payment($1::uuid, 'rejected', 'Comprobante no coincide', $2::uuid)`,
    [raceOrderB.created.id, adminId],
  )
  await query(
    `select public.admin_update_payment($1::uuid, 'pending', 'Solicitar nuevo reporte', $2::uuid)`,
    [raceOrderB.created.id, adminId],
  )
  await query(
    `select public.admin_update_payment($1::uuid, 'review', 'Revisión manual sin nuevo reporte', $2::uuid)`,
    [raceOrderB.created.id, adminId],
  )
  await expectError(
    `select public.admin_update_payment($1::uuid, 'paid', 'Reintento de aprobación', $2::uuid)`,
    [raceOrderB.created.id, adminId],
    '22023',
    'un reporte rechazado no se puede aprobar en un reintento administrativo',
  )
  await query(
    `select public.submit_public_payment_report($1, $2, 'REF-RACE-B2', '', 10000, 'VES', current_date, '123e4567-e89b-12d3-a456-426614174003.pdf')`,
    [raceOrderB.created.code, createHash('sha256').update('competing-order-b').digest('hex')],
  )
  const [racePaidB] = await query(
    `select public.admin_update_payment($1::uuid, 'paid', 'Prueba autorizada', $2::uuid) as result`,
    [raceOrderB.created.id, adminId],
  )
  ok(
    racePaidB.result.orderStatus === 'inventory_exception',
    'el segundo pago no puede vender las unidades ya consumidas',
  )
  const [noOversell] = await query('select stock from public.variants where id = $1', [variant.id])
  ok(noOversell.stock === 0, 'la competencia nunca deja stock negativo ni lo descuenta dos veces')

  const [prepared] = await query(
    `select public.admin_update_fulfillment($1::uuid, 'preparing', 'Listo para despacho', $2::uuid) as result`,
    [created.id, adminId],
  )
  ok(prepared.result.fulfillmentStatus === 'preparing', 'pasa a preparación tras el pago')

  await expectError(
    `select public.admin_set_shipping_details($1::uuid, 'MRW', 'MRW-0001', 'Sucursal centro', $2::uuid)`,
    [created.id, '44444444-4444-4444-8444-444444444444'],
    '42501',
    'un usuario sin membresía no puede registrar datos de envío',
  )
  const [shippingDetails] = await query(
    `select public.admin_set_shipping_details($1::uuid, 'MRW', 'MRW-0001', 'Sucursal centro', $2::uuid) as result`,
    [created.id, adminId],
  )
  ok(
    shippingDetails.result.shippingCompany === 'MRW' &&
      shippingDetails.result.shippingTrackingNumber === 'MRW-0001',
    'un administrador registra empresa y guía manuales',
  )
  const [shippingLookup] = await query('select public.lookup_public_order($1, $2) as order_data', [
    created.code,
    tokenHash,
  ])
  ok(
    shippingLookup.order_data?.shippingCompany === 'MRW' &&
      shippingLookup.order_data?.shippingTrackingNumber === 'MRW-0001' &&
      shippingLookup.order_data?.shippingNotes === 'Sucursal centro',
    'el comprador ve los datos de envío con su enlace privado',
  )
  const [whatsappShipping] = await query(
    `select public.lookup_whatsapp_orders(regexp_replace($1, '[^0-9]', '', 'g'), $2) as orders`,
    [customer.phone, created.code],
  )
  ok(
    whatsappShipping.orders?.[0]?.shippingCompany === 'MRW' &&
      whatsappShipping.orders?.[0]?.shippingTrackingNumber === 'MRW-0001',
    'el asistente de WhatsApp recibe los datos de despacho del pedido verificado',
  )

  const [shipped] = await query(
    `select public.admin_update_fulfillment($1::uuid, 'shipped', 'MRW guía manual', $2::uuid) as result`,
    [created.id, adminId],
  )
  ok(shipped.result.fulfillmentStatus === 'shipped', 'se registra el despacho manual')
  const [delivered] = await query(
    `select public.admin_update_fulfillment($1::uuid, 'delivered', 'Entregado', $2::uuid) as result`,
    [created.id, adminId],
  )
  ok(delivered.result.fulfillmentStatus === 'delivered', 'se registra la entrega')

  console.log('7. Ajustes administrativos del inventario')
  const [beforeStock] = await query('select stock from public.variants where id = $1', [variant.id])
  const [receivedStock] = await query(
    `select public.admin_adjust_variant_stock($1::uuid, $2, 'add', 3, 'Recepción ficticia de prueba') as result`,
    [adminId, variant.id],
  )
  ok(
    receivedStock.result.stock === beforeStock.stock + 3 && receivedStock.result.delta === 3,
    'el administrador puede registrar una entrada de unidades',
  )
  const [subtractedStock] = await query(
    `select public.admin_adjust_variant_stock($1::uuid, $2, 'subtract', 2, 'Salida ficticia de prueba') as result`,
    [adminId, variant.id],
  )
  ok(
    subtractedStock.result.stock === beforeStock.stock + 1 && subtractedStock.result.delta === -2,
    'el administrador puede restar unidades con un movimiento registrado',
  )
  const [fixedStock] = await query(
    `select public.admin_adjust_variant_stock($1::uuid, $2, 'set', 2, 'Corrección de prueba') as result`,
    [adminId, variant.id],
  )
  ok(fixedStock.result.stock === 2, 'el administrador puede fijar el total disponible')
  await expectError(
    `select public.admin_adjust_variant_stock($1::uuid, $2, 'subtract', 3, null)`,
    [adminId, variant.id],
    'P0001',
    'rechaza una salida superior al stock sin permitir cantidades negativas',
  )
  await expectError(
    `select public.admin_adjust_variant_stock('44444444-4444-4444-8444-444444444444'::uuid, $1, 'add', 1, null)`,
    [variant.id],
    '42501',
    'rechaza el ajuste de inventario de un usuario sin autorización',
  )
  const [movementCount] = await query(
    `select count(*)::int as count from public.inventory_movements where variant_id = $1 and note in ('Recepción ficticia de prueba', 'Salida ficticia de prueba', 'Corrección de prueba')`,
    [variant.id],
  )
  ok(movementCount.count === 3, 'cada cambio manual conserva su movimiento de inventario')

  console.log('8. RLS y permisos')
  const sensitive = await query(`
    select tablename, rowsecurity
    from pg_tables
    where schemaname = 'public'
      and tablename in (
        'orders', 'order_items', 'payment_attempts', 'audit_events', 'admin_users',
        'whatsapp_conversations', 'whatsapp_outbound_messages', 'whatsapp_handoffs',
        'payment_methods', 'whatsapp_purchase_contexts', 'bcv_rate_cache'
      )
  `)
  ok(
    sensitive.length === 11 && sensitive.every((table) => table.rowsecurity),
    'RLS activo en tablas sensibles',
  )

  const [reportPrivileges] = await query(`
    select
      has_function_privilege('anon', 'public.submit_public_payment_report(text,text,text,text,bigint,text,date,text)', 'EXECUTE') as anon_report,
      has_function_privilege('authenticated', 'public.submit_public_payment_report(text,text,text,text,bigint,text,date,text)', 'EXECUTE') as auth_report,
      has_function_privilege('service_role', 'public.submit_public_payment_report(text,text,text,text,bigint,text,date,text)', 'EXECUTE') as service_report
  `)
  ok(
    reportPrivileges.anon_report === false,
    'anon no puede invocar directamente el registro del reporte',
  )
  ok(
    reportPrivileges.auth_report === false,
    'authenticated tampoco puede saltarse la Edge Function',
  )
  ok(reportPrivileges.service_report === true, 'solo la Edge Function puede guardar reportes')

  const [privileges] = await query(`
    select
      has_function_privilege('anon', 'public.submit_public_payment_reference(text,text,text,text)', 'EXECUTE') as anon_reference,
      has_function_privilege('authenticated', 'public.create_public_order_v2(uuid,text,jsonb,text,jsonb,text,text,text,jsonb,uuid,integer,integer,integer,bigint)', 'EXECUTE') as auth_order,
      has_function_privilege('service_role', 'public.lookup_public_order(text,text)', 'EXECUTE') as service_lookup
  `)
  ok(privileges.anon_reference === false, 'anon no puede ejecutar la función de referencia')
  ok(
    privileges.auth_order === false,
    'un usuario autenticado no puede crear pedidos saltándose la Edge Function',
  )
  ok(privileges.service_lookup === true, 'service_role conserva la consulta privada')
  const [stockPrivileges] = await query(`
    select
      has_function_privilege('anon', 'public.admin_adjust_variant_stock(uuid,text,text,integer,text)', 'EXECUTE') as anon_stock,
      has_function_privilege('authenticated', 'public.admin_adjust_variant_stock(uuid,text,text,integer,text)', 'EXECUTE') as auth_stock,
      has_function_privilege('service_role', 'public.admin_adjust_variant_stock(uuid,text,text,integer,text)', 'EXECUTE') as service_stock
  `)
  ok(stockPrivileges.anon_stock === false, 'anon no puede modificar existencias directamente')
  ok(
    stockPrivileges.auth_stock === false,
    'authenticated no puede saltarse la función administrativa',
  )
  ok(
    stockPrivileges.service_stock === true,
    'la Edge Function administrativa puede ajustar existencias',
  )

  await db.exec('set role anon')
  const [publicProducts] = await query('select count(*)::int as count from public.products')
  ok(publicProducts.count === 20, 'anon solo ve productos activos por la política pública')
  await db.exec('reset role')

  await db.exec('set role anon')
  let denied = false
  try {
    await query('select count(*) from public.orders')
  } catch {
    denied = true
  }
  await db.exec('reset role')
  ok(denied, 'anon no puede leer la tabla de pedidos')

  console.log(`\nBase de datos verificada: ${String(passed)} comprobaciones correctas.`)
} finally {
  await db.close()
}
