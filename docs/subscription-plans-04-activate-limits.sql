-- FULL RELEASE ONLY. Apply after migrations 01/02 and the compatible app deployment.
-- Assign the reviewed manual customer Unlimited before this step.
-- Enables Pro quotas for current/future businesses. Free/Unlimited quotas are unchanged.
begin;

do $activation$
begin
  if exists (
    select 1 from public.businesses
    where id = '90593413-c118-449d-9752-7ee3f5de6daf'
      and (subscription_tier::text <> 'unlimited' or manual_subscription_tier is distinct from 'unlimited')
  ) then
    raise exception 'Assign MEDICINA INTEGRAL CANNING manual Unlimited access before enabling Pro limits.';
  end if;
end;
$activation$;

alter table public.businesses alter column pro_limits_enabled set default true;

create or replace function public.protect_business_plan_fields()
returns trigger language plpgsql set search_path = '' as $function$
begin
  if current_user in ('anon', 'authenticated') and (
    (tg_op = 'INSERT' and (new.subscription_tier::text <> 'free' or new.manual_subscription_tier is not null))
    or (tg_op = 'UPDATE' and (new.subscription_tier is distinct from old.subscription_tier
      or new.manual_subscription_tier is distinct from old.manual_subscription_tier
      or new.pro_limits_enabled is distinct from old.pro_limits_enabled))
  ) then raise exception 'Plan fields can only be changed by the server.' using errcode = '42501'; end if;
  -- Referral workflows may request PRO, but must retain a higher manual grant.
  if new.manual_subscription_tier = 'unlimited' then new.subscription_tier := 'unlimited';
  elsif new.manual_subscription_tier = 'pro' and new.subscription_tier::text = 'free' then new.subscription_tier := 'pro';
  end if;
  -- The full release enables quotas for new businesses even if a client submits false.
  if tg_op = 'INSERT' then new.pro_limits_enabled := true; end if;
  return new;
end;
$function$;

update public.businesses set pro_limits_enabled = true where not pro_limits_enabled;

notify pgrst, 'reload schema';
commit;
