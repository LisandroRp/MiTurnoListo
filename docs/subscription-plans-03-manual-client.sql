-- PREPARED ONLY. Do not run until both migrations and the compatible application are deployed.
-- Preferred alternative: use the super admin plan selector after enabling the release flag.
-- To use SQL, fill the two administrator fields below. Null defaults deliberately abort.
begin;
do $migration$
declare
  actor_id uuid := null; -- Set the verified super_admins.user_id.
  actor_email text := null; -- Set the same administrator's auth.users.email.
  target_id constant uuid := '90593413-c118-449d-9752-7ee3f5de6daf';
  current_tier text;
  manual_tier text;
begin
  if actor_id is null or actor_email is null then raise exception 'Set the verified administrator UUID and email before running this script.'; end if;
  select subscription_tier::text, manual_subscription_tier into strict current_tier, manual_tier
    from public.businesses where id = target_id and name = 'MEDICINA INTEGRAL CANNING' for update;
  if not exists (
    select 1 from public.business_memberships m join auth.users u on u.id = m.user_id
    where m.business_id = target_id and m.role = 'owner' and lower(u.email) = 'consultoriosmic@gmail.com'
  ) then raise exception 'The target business owner does not match the reviewed account.'; end if;
  if current_tier = 'unlimited' and manual_tier = 'unlimited' then
    raise notice 'The reviewed business already has manual Unlimited access.';
    return;
  end if;
  if current_tier <> 'pro' then raise exception 'The target plan changed since review; inspect before continuing.'; end if;
  perform public.set_manual_business_plan(target_id, 'unlimited', actor_id, actor_email);
end;
$migration$;
commit;
