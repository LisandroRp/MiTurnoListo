-- Run after migrations 01, 02 and 04. Updates visibility quotas and verification metadata; does not
-- delete, archive, or hide existing rows. Appointment enforcement is preserved.
-- New resources beyond the FREE or PRO visibility quota are inserted as hidden.
-- Attempts to make existing hidden resources visible beyond quota are rejected.
begin;

-- Verification metadata is separate from paid/manual entitlement state.
create table if not exists public.subscription_verifications (
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider_reference text not null check (length(provider_reference) between 1 and 256),
  failure_count integer not null default 0 check (failure_count between 0 and 2),
  failed_cycles integer not null default 0 check (failed_cycles between 0 and 2),
  failure_kind text check (failure_kind in ('not_found', 'permission', 'temporary')),
  needs_review boolean not null default false,
  retry_after timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (business_id, provider_reference)
);
alter table public.subscription_verifications add column if not exists failed_cycles integer not null default 0 check (failed_cycles between 0 and 2);
alter table public.subscription_verifications enable row level security;
revoke all on public.subscription_verifications from public, anon, authenticated;
grant select, insert, update, delete on public.subscription_verifications to service_role;

create or replace function public.claim_subscription_verification(p_business_id uuid, p_reference text)
returns jsonb language plpgsql security definer set search_path = '' as $verification$
declare entry public.subscription_verifications%rowtype; lease uuid;
begin
  if p_reference is null or length(p_reference) not between 1 and 256 then raise exception 'Invalid verification reference.'; end if;
  perform 1 from public.businesses where id = p_business_id for update;
  if not found then raise exception 'Business not found.'; end if;
  insert into public.subscription_verifications(business_id, provider_reference)
    values (p_business_id, p_reference) on conflict do nothing;
  select * into strict entry from public.subscription_verifications
    where business_id = p_business_id and provider_reference = p_reference for update;
  if entry.needs_review or entry.retry_after > now() then
    return jsonb_build_object('allowed', false, 'failure_kind', entry.failure_kind, 'retry_after', entry.retry_after, 'needs_review', entry.needs_review);
  end if;
  if entry.lease_until > now() then
    return jsonb_build_object('allowed', false, 'failure_kind', 'temporary', 'retry_after', entry.lease_until);
  end if;
  lease := gen_random_uuid();
  update public.subscription_verifications set lease_token = lease, lease_until = now() + interval '60 seconds',
    failure_count = 0, failure_kind = null, retry_after = null, last_attempt_at = now(), updated_at = now()
    where business_id = p_business_id and provider_reference = p_reference;
  return jsonb_build_object('allowed', true, 'token', lease);
end;
$verification$;

create or replace function public.finish_subscription_verification(
  p_business_id uuid, p_reference text, p_token uuid, p_outcome text, p_attempts integer
) returns jsonb language plpgsql security definer set search_path = '' as $verification$
declare resume_at timestamptz; review_required boolean; affected integer;
begin
  if p_outcome is null or p_outcome not in ('success', 'aborted', 'not_found', 'permission', 'temporary')
    or p_attempts is null or p_attempts not between 1 and 2 then raise exception 'Invalid verification outcome.'; end if;
  update public.subscription_verifications set
    failure_count = case when p_outcome in ('success','aborted') then 0 else p_attempts end,
    failure_kind = case when p_outcome in ('success','aborted') then null else p_outcome end,
    failed_cycles = case when p_outcome = 'success' then 0 when p_outcome = 'temporary' then least(failed_cycles + 1, 2) else failed_cycles end,
    needs_review = p_outcome in ('not_found','permission') or (p_outcome = 'temporary' and failed_cycles + 1 >= 2),
    retry_after = case when p_outcome = 'temporary' and failed_cycles + 1 < 2 then now() + interval '30 minutes' else null end,
    lease_token = null, lease_until = null,
    last_success_at = case when p_outcome = 'success' then now() else last_success_at end,
    updated_at = now()
    where business_id = p_business_id and provider_reference = p_reference and lease_token = p_token
    returning retry_after, needs_review into resume_at, review_required;
  get diagnostics affected = row_count;
  return jsonb_build_object('applied', affected = 1, 'retry_after', resume_at, 'needs_review', review_required);
end;
$verification$;

-- Support operators may resume checks after reviewing a missing reference or fixing credentials.
-- This never modifies subscriptions or access grants.
create or replace function public.resume_subscription_verification(p_business_id uuid, p_reference text default null)
returns integer language plpgsql security definer set search_path = '' as $verification$
declare affected integer;
begin
  update public.subscription_verifications set failure_count = 0, failed_cycles = 0, failure_kind = null, needs_review = false,
    retry_after = null, lease_token = null, lease_until = null, updated_at = now()
    where business_id = p_business_id and (p_reference is null or provider_reference = p_reference);
  get diagnostics affected = row_count;
  return affected;
end;
$verification$;
revoke all on function public.claim_subscription_verification(uuid,text) from public, anon, authenticated;
revoke all on function public.finish_subscription_verification(uuid,text,uuid,text,integer) from public, anon, authenticated;
revoke all on function public.resume_subscription_verification(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_subscription_verification(uuid,text) to service_role;
grant execute on function public.finish_subscription_verification(uuid,text,uuid,text,integer) to service_role;
grant execute on function public.resume_subscription_verification(uuid,text) to service_role;

create or replace function public.enforce_pro_plan_quota()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare tier text; enabled boolean; zone text; usage bigint; month_start timestamptz; month_end timestamptz; visible_limit integer; plan_label text;
begin
  select subscription_tier::text, pro_limits_enabled, timezone into tier, enabled, zone
    from public.businesses where id = new.business_id for update;
  if tier = 'free' then plan_label := 'FREE';
  elsif tier = 'pro' and coalesce(enabled, false) then plan_label := 'PRO';
  else return new; end if;
  if tg_table_name = 'employees' then
    visible_limit := case when tier = 'free' then 1 else 3 end;
    if not new.is_active or not coalesce(new.is_public, false) then return new; end if;
    if tg_op = 'UPDATE' and old.is_active and old.is_public and old.business_id = new.business_id then return new; end if;
    select count(*) into usage from public.employees where business_id = new.business_id and is_active and is_public and id <> new.id;
    if usage >= visible_limit then
      if tg_op = 'INSERT' and not exists (select 1 from public.employees where id = new.id) then
        new.is_public := false;
      elsif exists (select 1 from public.employees where id = new.id and business_id = new.business_id and is_active and is_public) then
        return new;
      else
        raise exception 'PLAN_LIMIT:El plan % permite hasta % empleados visibles. Ocultá otro para activar este o cambiá de plan.', plan_label, visible_limit;
      end if;
    end if;
  elsif tg_table_name = 'services' then
    visible_limit := case when tier = 'free' then 2 else 10 end;
    if not new.is_active or not coalesce(new.is_public, false) then return new; end if;
    if tg_op = 'UPDATE' and old.is_active and old.is_public and old.business_id = new.business_id then return new; end if;
    select count(*) into usage from public.services where business_id = new.business_id and is_active and is_public and id <> new.id;
    if usage >= visible_limit then
      if tg_op = 'INSERT' and not exists (select 1 from public.services where id = new.id) then
        new.is_public := false;
      elsif exists (select 1 from public.services where id = new.id and business_id = new.business_id and is_active and is_public) then
        return new;
      else
        raise exception 'PLAN_LIMIT:El plan % permite hasta % servicios visibles. Ocultá otro para activar este o cambiá de plan.', plan_label, visible_limit;
      end if;
    end if;
  elsif tg_table_name = 'appointments' then
    if tier <> 'pro' then return new; end if;
    if coalesce(new.appointment_status::text, 'scheduled') in ('cancelled', 'rescheduled') or coalesce(new.status::text, 'pending') = 'cancelled' then return new; end if;
    zone := coalesce(nullif(zone, ''), 'America/Argentina/Buenos_Aires');
    month_start := date_trunc('month', new.starts_at at time zone zone) at time zone zone;
    month_end := (date_trunc('month', new.starts_at at time zone zone) + interval '1 month') at time zone zone;
    if tg_op = 'UPDATE' and old.business_id = new.business_id
      and coalesce(old.appointment_status::text, 'scheduled') not in ('cancelled', 'rescheduled') and coalesce(old.status::text, 'pending') <> 'cancelled'
      and old.starts_at >= month_start and old.starts_at < month_end then return new; end if;
    if tg_op = 'INSERT' and new.rescheduled_from_appointment_id is not null then
      -- Move the source out of quota accounting atomically with its replacement.
      -- A rejected insert rolls this update back, preserving the original booking.
      perform 1 from public.appointments where id = new.rescheduled_from_appointment_id
        and business_id = new.business_id and coalesce(appointment_status::text, 'scheduled') not in ('cancelled', 'rescheduled') for update;
      if not found then raise exception 'Invalid rescheduling source.'; end if;
      update public.appointments set appointment_status = 'rescheduled'
        where id = new.rescheduled_from_appointment_id and business_id = new.business_id;
    end if;
    select count(*) into usage from public.appointments where business_id = new.business_id and id <> new.id
      and coalesce(appointment_status::text, 'scheduled') not in ('cancelled', 'rescheduled') and coalesce(status::text, 'pending') <> 'cancelled'
      and starts_at >= month_start and starts_at < month_end;
    if usage >= 150 then raise exception 'PLAN_LIMIT:El plan Pro permite hasta 150 turnos por mes.'; end if;
  end if;
  return new;
end;
$function$;
revoke all on function public.enforce_pro_plan_quota() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
