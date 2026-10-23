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
    const sql = await readFile(join(migrationsDir, migration), 'utf8')
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

  await query(`
    update public.payment_methods
    set active = true,
        public_instructions = 'Pago Móvil de prueba: banco ficticio, cuenta 0000. No transferir dinero real.'
    where method = 'pago_movil'
  `)

  const [quoteRow] = await query('select public.issue_demo_quote() as quote')
  const quote = quoteRow.quote
  ok(quote?.id && quote.source === 'demo_ficticia', 'cotización de demostración emitida')

  const [variant] = await query(`
    select v.id, v.stock, p.price_cents
    from public.variants v
    join public.products p on p.id = v.product_id
    where p.active and v.stock >= 3
    order by v.sku
    limit 1
  `)
  ok(Boolean(variant), 'variante con existencias disponible')

  const items = JSON.stringify([{ variant_id: variant.id, quantity: 2 }])
  const [previewRow] = await query(
    'select public.preview_public_order($1::jsonb, $2, $3::uuid) as preview',
    [items, 'retiro', quote.id],
  )
  const preview = previewRow.preview
  ok(preview.totalCents === variant.price_cents * 2, 'el servidor recalcula el total')
  ok(preview.shippingCents === 0, 'retiro sin costo de envío')

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

  const [referenceRow] = await query(
    'select public.submit_public_payment_reference($1, $2, $3, $4) as result',
    [created.code, tokenHash, 'REF-12345', 'Transferencia del 22/10'],
  )
  ok(referenceRow.result.paymentStatus === 'review', 'la referencia deja el pago en revisión')
  ok(referenceRow.result.alreadySubmitted === false, 'la primera referencia se registra')

  const [duplicateReference] = await query(
    'select public.submit_public_payment_reference($1, $2, $3, $4) as result',
    [created.code, tokenHash, 'REF-12345', ''],
  )
  ok(
    duplicateReference.result.alreadySubmitted === true,
    'reenviar la misma referencia es idempotente',
  )

  await expectError(
    'select public.submit_public_payment_reference($1, $2, $3, $4)',
    [created.code, 'b'.repeat(64), 'REF-99999', ''],
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
  const adminId = '33333333-3333-4333-8333-333333333333'
  await query('insert into auth.users (id, email) values ($1::uuid, $2)', [
    adminId,
    'admin@example.test',
  ])
  await query('insert into public.admin_users (user_id) values ($1::uuid)', [adminId])

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

  console.log('7. RLS y permisos')
  const sensitive = await query(`
    select tablename, rowsecurity
    from pg_tables
    where schemaname = 'public'
      and tablename in (
        'orders', 'order_items', 'payment_attempts', 'audit_events', 'admin_users',
        'whatsapp_conversations', 'whatsapp_outbound_messages', 'whatsapp_handoffs',
        'payment_methods', 'whatsapp_purchase_contexts'
      )
  `)
  ok(
    sensitive.length === 10 && sensitive.every((table) => table.rowsecurity),
    'RLS activo en tablas sensibles',
  )

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
