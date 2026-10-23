-- Minimal global counters for optional free-tier AI calls. No customer data is stored.
create table public.whatsapp_ai_usage_control (
  singleton_id smallint primary key default 1 check (singleton_id = 1),
  minute_bucket timestamptz not null,
  minute_requests integer not null default 0 check (minute_requests >= 0),
  utc_day date not null,
  day_requests integer not null default 0 check (day_requests >= 0),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_ai_usage_control enable row level security;
revoke all on public.whatsapp_ai_usage_control from public, anon, authenticated;
grant all on public.whatsapp_ai_usage_control to service_role;

create or replace function public.reserve_whatsapp_ai_request(
  p_max_per_minute integer,
  p_max_per_day integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_minute timestamptz := date_trunc('minute', now() at time zone 'UTC') at time zone 'UTC';
  current_day date := (now() at time zone 'UTC')::date;
  stored_minute timestamptz;
  stored_minute_requests integer;
  stored_day date;
  stored_day_requests integer;
  effective_minute_requests integer;
  effective_day_requests integer;
begin
  if p_max_per_minute is null or p_max_per_minute < 1 or p_max_per_minute > 8
    or p_max_per_day is null or p_max_per_day < 1 or p_max_per_day > 100 then
    raise exception 'Invalid WhatsApp AI usage limits.' using errcode = '22023';
  end if;

  insert into public.whatsapp_ai_usage_control (
    singleton_id, minute_bucket, minute_requests, utc_day, day_requests
  ) values (1, current_minute, 0, current_day, 0)
  on conflict (singleton_id) do nothing;

  select minute_bucket, minute_requests, utc_day, day_requests
    into stored_minute, stored_minute_requests, stored_day, stored_day_requests
    from public.whatsapp_ai_usage_control
    where singleton_id = 1
    for update;

  effective_minute_requests := case
    when stored_minute = current_minute then stored_minute_requests else 0 end;
  effective_day_requests := case
    when stored_day = current_day then stored_day_requests else 0 end;

  if effective_day_requests >= p_max_per_day then
    update public.whatsapp_ai_usage_control set
      minute_bucket = current_minute,
      minute_requests = effective_minute_requests,
      utc_day = current_day,
      day_requests = effective_day_requests,
      updated_at = now()
      where singleton_id = 1;
    return 'daily_limit';
  end if;

  if effective_minute_requests >= p_max_per_minute then
    update public.whatsapp_ai_usage_control set
      minute_bucket = current_minute,
      minute_requests = effective_minute_requests,
      utc_day = current_day,
      day_requests = effective_day_requests,
      updated_at = now()
      where singleton_id = 1;
    return 'minute_limit';
  end if;

  update public.whatsapp_ai_usage_control set
    minute_bucket = current_minute,
    minute_requests = effective_minute_requests + 1,
    utc_day = current_day,
    day_requests = effective_day_requests + 1,
    updated_at = now()
    where singleton_id = 1;
  return 'allowed';
end;
$$;

revoke execute on function public.reserve_whatsapp_ai_request(integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_whatsapp_ai_request(integer, integer) to service_role;
