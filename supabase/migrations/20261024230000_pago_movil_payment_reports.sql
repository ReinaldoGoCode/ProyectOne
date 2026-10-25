-- Datos públicos autorizados por el comercio y captura segura de reportes.
-- El reporte nunca marca un pago como aprobado; solo administración puede hacerlo.

alter table public.payment_attempts
  add column reported_amount_cents bigint check (reported_amount_cents is null or reported_amount_cents > 0),
  add column reported_currency text not null default 'VES' check (reported_currency in ('VES', 'USD')),
  add column paid_at date,
  add column receipt_path text check (
    receipt_path is null or receipt_path ~ '^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'
  ),
  add column amount_matches boolean;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Desactiva el método Efectivo USD que estaba activo como demostración, sin
-- borrar sus instrucciones ni alterar la configuración de otros métodos.
update public.payment_methods
set active = false, updated_at = now()
where method = 'efectivo_usd' and active;

-- El Pago Móvil confirmado queda activo, pero continúa siendo manual y exige
-- confirmación de una persona autorizada.
update public.payment_methods
set active = true,
    public_instructions = E'Pago Móvil\nBanco: Banco Venezolano de Crédito\nCédula o RIF: V-14082115\nTeléfono: 0412-3095646\nLa tasa de 40 Bs./USD de esta tienda es ficticia. Confirma el monto en bolívares con Norte Moda antes de transferir.',
    updated_at = now()
where method = 'pago_movil' and kind = 'manual';

create or replace function public.submit_public_payment_report(
  p_code text,
  p_tracking_token_hash text,
  p_reference text,
  p_note text,
  p_reported_amount_cents bigint,
  p_reported_currency text,
  p_paid_at date,
  p_receipt_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
  existing_attempt public.payment_attempts;
  normalized_reference text := upper(regexp_replace(trim(coalesce(p_reference, '')), '\s+', ' ', 'g'));
  normalized_note text := left(trim(coalesce(p_note, '')), 300);
  previous_status text;
  quote_source text;
  amount_matches_value boolean;
  submitted_at timestamptz := now();
begin
  if p_code is null
    or p_code !~ '^NM-[0-9]{3,12}$'
    or p_tracking_token_hash !~ '^[0-9a-f]{64}$'
    or normalized_reference !~ '^[A-Z0-9][A-Z0-9._ -]{3,79}$'
    or p_reported_amount_cents is null
    or p_reported_amount_cents < 1
    or p_reported_amount_cents > 9007199254740991
    or p_reported_currency not in ('VES', 'USD')
    or p_paid_at is null
    or p_paid_at > current_date
    or (p_receipt_path is not null and p_receipt_path !~ '^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$') then
    raise exception 'Invalid payment report request.' using errcode = '22023';
  end if;

  select * into order_row
    from public.orders
    where upper(code) = upper(trim(p_code))
      and tracking_token_hash = p_tracking_token_hash
    for update;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;

  if order_row.order_status = 'cancelled' or order_row.payment_status = 'cancelled' then
    raise exception 'Cancelled orders do not accept payment reports.' using errcode = '22023';
  end if;
  if order_row.payment_method <> 'pago_movil' then
    raise exception 'This order does not use Pago Móvil.' using errcode = '22023';
  end if;

  if order_row.payment_status = 'paid' then
    return jsonb_build_object(
      'paymentStatus', order_row.payment_status,
      'reference', null,
      'submittedAt', null,
      'alreadySubmitted', false,
      'alreadyVerified', true,
      'amountMatches', null
    );
  end if;

  select * into existing_attempt
    from public.payment_attempts
    where order_id = order_row.id and reference = normalized_reference
    order by created_at desc
    limit 1;
  if found then
    return jsonb_build_object(
      'paymentStatus', order_row.payment_status,
      'reference', existing_attempt.reference,
      'submittedAt', existing_attempt.created_at,
      'alreadySubmitted', true,
      'alreadyVerified', false,
      'amountMatches', existing_attempt.amount_matches
    );
  end if;

  select q.source into quote_source
    from public.exchange_quotes q where q.id = order_row.exchange_quote_id;
  if p_reported_currency = 'USD' then
    amount_matches_value := p_reported_amount_cents = order_row.total_cents;
  elsif quote_source = 'bcv' then
    amount_matches_value := p_reported_amount_cents = order_row.ves_total_cents;
  else
    amount_matches_value := null;
  end if;

  previous_status := order_row.payment_status;
  insert into public.payment_attempts (
    order_id, payment_method, status, reference, note, reported_amount_cents,
    reported_currency, paid_at, receipt_path, amount_matches
  ) values (
    order_row.id, order_row.payment_method, 'review', normalized_reference,
    nullif(normalized_note, ''), p_reported_amount_cents, p_reported_currency,
    p_paid_at, p_receipt_path, amount_matches_value
  );

  update public.orders
    set payment_status = 'review'
    where id = order_row.id and payment_status in ('pending', 'rejected');

  insert into public.audit_events (order_id, axis, from_status, to_status, note)
    values (
      order_row.id,
      'payment',
      previous_status,
      'review',
      'El comprador reportó un Pago Móvil. Pendiente de verificación manual.'
    );

  return jsonb_build_object(
    'paymentStatus', 'review',
    'reference', normalized_reference,
    'submittedAt', submitted_at,
    'alreadySubmitted', false,
    'alreadyVerified', false,
    'amountMatches', amount_matches_value
  );
end;
$$;

revoke execute on function public.submit_public_payment_report(text, text, text, text, bigint, text, date, text)
  from public, anon, authenticated;
grant execute on function public.submit_public_payment_report(text, text, text, text, bigint, text, date, text)
  to service_role;

create or replace function public.require_pago_movil_report_before_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status = 'paid'
    and old.payment_status is distinct from 'paid'
    and new.payment_method = 'pago_movil'
    and not exists (
      select 1 from public.payment_attempts pa
      where pa.order_id = old.id
        and pa.status = 'review'
        and pa.reference is not null
        and pa.reported_amount_cents is not null
        and pa.paid_at is not null
        and pa.receipt_path is not null
        and pa.created_at > coalesce(
          (
            select max(decision.created_at)
            from public.payment_attempts decision
            where decision.order_id = old.id and decision.reviewed_by is not null
          ),
          '-infinity'::timestamptz
        )
    ) then
    raise exception 'A complete Pago Móvil report must be reviewed before approval.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.require_pago_movil_report_before_paid() from public, anon, authenticated;
drop trigger if exists require_pago_movil_report_before_paid on public.orders;
create trigger require_pago_movil_report_before_paid
  before update of payment_status on public.orders
  for each row execute function public.require_pago_movil_report_before_paid();
