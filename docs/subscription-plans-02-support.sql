-- Prepared only. Requires subscription-plans-01-enum.sql to be committed first.
-- Does not activate PRO limits or migrate any business to Unlimited.
begin;

alter table public.businesses
  add column if not exists manual_subscription_tier text,
  add column if not exists pro_limits_enabled boolean not null default false;

alter table public.businesses drop constraint if exists businesses_manual_subscription_tier_check;
alter table public.businesses add constraint businesses_manual_subscription_tier_check
  check (manual_subscription_tier is null or manual_subscription_tier in ('pro', 'unlimited'));

-- The subscriptions tier is text. Replace only the known legacy two-value check;
-- abort on any other tier-specific check instead of silently removing invariants.
do $migration$
declare c record;
begin
  for c in
    select con.conname, pg_get_constraintdef(con.oid) as definition
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attname = 'subscription_tier'
    where con.conrelid = 'public.business_subscriptions'::regclass
      and con.contype = 'c' and att.attnum = any(con.conkey)
  loop
    if c.definition = $$CHECK ((subscription_tier = ANY (ARRAY['free'::text, 'pro'::text])))$$ then
      execute format('alter table public.business_subscriptions drop constraint %I', c.conname);
    elsif c.definition <> $$CHECK ((subscription_tier = ANY (ARRAY['free'::text, 'pro'::text, 'unlimited'::text])))$$ then
      raise exception 'Inspect subscription tier constraint before migration: %', c.conname;
    end if;
  end loop;
end;
$migration$;

alter table public.business_subscriptions drop constraint if exists business_subscriptions_tier_v2_check;
alter table public.business_subscriptions add constraint business_subscriptions_tier_v2_check
  check (subscription_tier in ('free', 'pro', 'unlimited'));

-- Preserve only grants supported by an existing manual activation audit entry.
update public.businesses b set manual_subscription_tier = 'pro'
where b.subscription_tier = 'pro' and b.manual_subscription_tier is null
  and (select a.action from public.admin_audit_logs a where a.target_business_id = b.id
       order by a.created_at desc limit 1) = 'activatePro'
  and not exists (select 1 from public.business_subscriptions s where s.business_id = b.id
                  and s.provider = 'mercadopago' and s.provider_status = 'authorized');

create or replace function public.protect_business_plan_fields()
returns trigger language plpgsql set search_path = '' as $function$
begin
  if current_user in ('anon', 'authenticated') and (
    (tg_op = 'INSERT' and (new.subscription_tier::text <> 'free' or new.manual_subscription_tier is not null or new.pro_limits_enabled))
    or (tg_op = 'UPDATE' and (new.subscription_tier is distinct from old.subscription_tier
      or new.manual_subscription_tier is distinct from old.manual_subscription_tier
      or new.pro_limits_enabled is distinct from old.pro_limits_enabled))
  ) then raise exception 'Plan fields can only be changed by the server.' using errcode = '42501'; end if;
  -- Referral workflows may request PRO, but must retain a higher manual grant.
  if new.manual_subscription_tier = 'unlimited' then new.subscription_tier := 'unlimited';
  elsif new.manual_subscription_tier = 'pro' and new.subscription_tier::text = 'free' then new.subscription_tier := 'pro';
  end if;
  return new;
end;
$function$;
drop trigger if exists protect_business_plan_fields on public.businesses;
create trigger protect_business_plan_fields before insert or update on public.businesses
  for each row execute function public.protect_business_plan_fields();

create or replace function public.set_manual_business_plan(
  p_business_id uuid, p_tier text, p_actor_user_id uuid, p_actor_email text
) returns void language plpgsql security definer set search_path = '' as $function$
declare previous_tier text;
begin
  if p_tier not in ('free', 'pro', 'unlimited') or p_tier is null then raise exception 'Invalid manual plan.'; end if;
  if not exists (select 1 from public.super_admins where user_id = p_actor_user_id) then
    raise exception 'Super admin access required.' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_actor_user_id and lower(email) = lower(p_actor_email)) then
    raise exception 'Invalid audit actor.' using errcode = '42501';
  end if;
  select subscription_tier::text into strict previous_tier from public.businesses where id = p_business_id for update;
  if exists (select 1 from public.business_subscriptions where business_id = p_business_id
             and provider = 'mercadopago' and provider_status = 'authorized') then
    raise exception 'Manage the active paid subscription before changing a manual grant.';
  end if;
  update public.businesses set manual_subscription_tier = nullif(p_tier, 'free'),
    subscription_tier = p_tier::public.subscription_tier where id = p_business_id;
  insert into public.admin_audit_logs(actor_user_id, actor_email, target_business_id, action, previous_value, next_value)
  values (p_actor_user_id, p_actor_email, p_business_id,
    case p_tier when 'unlimited' then 'activateUnlimited' when 'pro' then 'activatePro' else 'downgradeFree' end,
    jsonb_build_object('subscriptionTier', previous_tier),
    jsonb_build_object('subscriptionTier', p_tier, 'source', 'manual'));
end;
$function$;
revoke all on function public.set_manual_business_plan(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.set_manual_business_plan(uuid, text, uuid, text) to service_role;

-- Serialize effective access reconciliation with manual grant changes.
create or replace function public.reconcile_business_subscription(p_business_id uuid)
returns text language plpgsql security definer set search_path = '' as $function$
declare manual_tier text; next_tier text;
begin
  select manual_subscription_tier into strict manual_tier from public.businesses where id = p_business_id for update;
  if manual_tier = 'unlimited' or exists (select 1 from public.business_subscriptions where business_id = p_business_id
      and provider = 'mercadopago' and provider_status = 'authorized' and subscription_tier = 'unlimited') then
    next_tier := 'unlimited';
  elsif manual_tier = 'pro' or exists (select 1 from public.business_subscriptions where business_id = p_business_id
      and provider = 'mercadopago' and provider_status = 'authorized' and subscription_tier = 'pro') then
    next_tier := 'pro';
  else next_tier := 'free'; end if;
  update public.businesses set subscription_tier = next_tier::public.subscription_tier where id = p_business_id;
  return next_tier;
end;
$function$;
revoke all on function public.reconcile_business_subscription(uuid) from public, anon, authenticated;
grant execute on function public.reconcile_business_subscription(uuid) to service_role;

-- PRO enforcement is staged per business. All existing rows default to false.
-- Serializing on the parent row protects quotas across concurrent requests.
create or replace function public.enforce_pro_plan_quota()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare tier text; enabled boolean; zone text; usage bigint; month_start timestamptz; month_end timestamptz;
begin
  select subscription_tier::text, pro_limits_enabled, timezone into tier, enabled, zone
    from public.businesses where id = new.business_id for update;
  if tier is distinct from 'pro' or not coalesce(enabled, false) then return new; end if;
  if tg_table_name = 'employees' then
    if not new.is_active then return new; end if;
    if tg_op = 'UPDATE' and old.is_active and old.business_id = new.business_id then return new; end if;
    select count(*) into usage from public.employees where business_id = new.business_id and is_active and id <> new.id;
    if usage >= 3 then raise exception 'PLAN_LIMIT:El plan Pro permite hasta 3 integrantes activos del personal.'; end if;
  elsif tg_table_name = 'services' then
    if not new.is_active then return new; end if;
    if tg_op = 'UPDATE' and old.is_active and old.business_id = new.business_id then return new; end if;
    select count(*) into usage from public.services where business_id = new.business_id and is_active and id <> new.id;
    if usage >= 10 then raise exception 'PLAN_LIMIT:El plan Pro permite hasta 10 servicios activos.'; end if;
  elsif tg_table_name = 'appointments' then
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
drop trigger if exists enforce_pro_plan_quota on public.employees;
create trigger enforce_pro_plan_quota before insert or update on public.employees for each row execute function public.enforce_pro_plan_quota();
drop trigger if exists enforce_pro_plan_quota on public.services;
create trigger enforce_pro_plan_quota before insert or update on public.services for each row execute function public.enforce_pro_plan_quota();
drop trigger if exists enforce_pro_plan_quota on public.appointments;
create trigger enforce_pro_plan_quota before insert or update on public.appointments for each row execute function public.enforce_pro_plan_quota();

notify pgrst, 'reload schema';
commit;
