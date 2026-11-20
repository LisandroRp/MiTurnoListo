-- ONE-OFF REPAIR: the owner confirmed this obsolete authorization was a cancelled test.
-- This updates local entitlement records only; it does not call Mercado Pago.
-- Keep subscriptions, payments, appointments, services, employees, and audit history.
begin;

do $repair$
declare
  business_id_to_repair constant uuid := '11111111-1111-4111-8111-111111111111';
  test_subscription_id constant uuid := '94d10c20-f995-41fe-bf9e-ff23f6401b24';
begin
  perform 1 from public.businesses b
    join public.business_memberships m on m.business_id = b.id and m.role = 'owner'
    join auth.users u on u.id = m.user_id
    where b.id = business_id_to_repair
      and lower(u.email) = 'lisandrorp1997@gmail.com'
    for update of b;
  if not found then raise exception 'Business owner verification failed.'; end if;

  if exists (select 1 from public.businesses where id = business_id_to_repair and manual_subscription_tier is not null) then
    raise exception 'A manual grant now exists. Review it before resetting access.';
  end if;
  if exists (select 1 from public.business_subscriptions
    where business_id = business_id_to_repair and provider = 'mercadopago'
      and provider_status = 'authorized' and id <> test_subscription_id) then
    raise exception 'Another authorized subscription exists. No changes were applied.';
  end if;
  if exists (select 1 from public.referral_rewards r
    join public.business_memberships m on m.user_id = r.user_id
    where m.business_id = business_id_to_repair and m.role = 'owner' and r.status = 'active') then
    raise exception 'An active referral reward exists. No changes were applied.';
  end if;

  update public.business_subscriptions
    set provider_status = 'invalid', subscription_tier = 'free',
        provider_subscription_id = null, updated_at = now()
    where id = test_subscription_id and business_id = business_id_to_repair
      and provider = 'mercadopago' and provider_status = 'authorized'
      and subscription_tier = 'pro'
      and updated_at = '2026-07-28T05:12:42.515+00:00'::timestamptz;
  if not found then raise exception 'The test record changed or was already repaired. Recheck before retrying.'; end if;

  perform public.reconcile_business_subscription(business_id_to_repair);
  if not exists (select 1 from public.businesses where id = business_id_to_repair and subscription_tier::text = 'free') then
    raise exception 'FREE reconciliation failed. All changes were rolled back.';
  end if;
end;
$repair$;

commit;

select id, name, subscription_tier::text as plan, manual_subscription_tier
from public.businesses where id = '11111111-1111-4111-8111-111111111111';
