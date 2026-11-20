-- LOCAL TEST DATABASE ONLY. Requires the synthetic fixture and migration 05.
begin;
create or replace function pg_temp.check_true(value boolean, description text) returns void language plpgsql as $$
begin if not coalesce(value,false) then raise exception 'Assertion failed: %', description; end if; end;
$$;
insert into public.businesses(id,name,subscription_tier,pro_limits_enabled)
  values ('a0000000-0000-4000-8000-000000000001','Local verification fixture','pro',true),
         ('a0000000-0000-4000-8000-000000000002','Other verification fixture','free',true);
insert into public.business_subscriptions(business_id,provider_status,subscription_tier,provider_subscription_id)
  values ('a0000000-0000-4000-8000-000000000001','authorized','pro','synthetic-provider');

do $test$
declare business constant uuid := 'a0000000-0000-4000-8000-000000000001'; claim jsonb; next_claim jsonb; finished jsonb; token uuid;
begin
  claim := public.claim_subscription_verification(business,'subscription:one');
  perform pg_temp.check_true((claim->>'allowed')::boolean,'first caller acquires lease');
  next_claim := public.claim_subscription_verification(business,'subscription:one');
  perform pg_temp.check_true(not (next_claim->>'allowed')::boolean,'concurrent caller does not acquire another lease');
  token := (claim->>'token')::uuid;
  finished := public.finish_subscription_verification(business,'subscription:one',token,'temporary',2);
  perform pg_temp.check_true((finished->>'applied')::boolean,'temporary failure is persisted');
  perform pg_temp.check_true((select failure_count=2 and retry_after=now()+interval '30 minutes' and not needs_review from public.subscription_verifications where business_id=business and provider_reference='subscription:one'),'two failures create a 30 minute cooldown');
  perform pg_temp.check_true(not (public.claim_subscription_verification(business,'subscription:one')->>'allowed')::boolean,'refresh during cooldown is blocked');
  update public.subscription_verifications set retry_after=now()-interval '1 second' where business_id=business;
  claim := public.claim_subscription_verification(business,'subscription:one');
  perform pg_temp.check_true((claim->>'allowed')::boolean,'expired cooldown permits another check');
  perform pg_temp.check_true(not (public.finish_subscription_verification(business,'subscription:one',token,'permission',1)->>'applied')::boolean,'stale token cannot overwrite a newer lease');
  perform public.finish_subscription_verification(business,'subscription:one',(claim->>'token')::uuid,'success',1);
  perform pg_temp.check_true((select failed_cycles=0 and failure_count=0 and failure_kind is null and retry_after is null and last_success_at is not null from public.subscription_verifications where business_id=business and provider_reference='subscription:one'),'success clears errors');


  claim := public.claim_subscription_verification(business,'subscription:exhausted');
  perform public.finish_subscription_verification(business,'subscription:exhausted',(claim->>'token')::uuid,'temporary',2);
  update public.subscription_verifications set retry_after=now()-interval '1 second' where business_id=business and provider_reference='subscription:exhausted';
  claim := public.claim_subscription_verification(business,'subscription:exhausted');
  perform public.finish_subscription_verification(business,'subscription:exhausted',(claim->>'token')::uuid,'temporary',2);
  perform pg_temp.check_true((select failed_cycles=2 and failure_count=2 and needs_review and retry_after is null from public.subscription_verifications where business_id=business and provider_reference='subscription:exhausted'),'four failed attempts require review rather than another cooldown');
  perform pg_temp.check_true(not (public.claim_subscription_verification(business,'subscription:exhausted')->>'allowed')::boolean,'there is no third verification batch');
  perform public.resume_subscription_verification(business,'subscription:exhausted');
  perform pg_temp.check_true((select failed_cycles=0 from public.subscription_verifications where business_id=business and provider_reference='subscription:exhausted'),'support reset clears failed batches');
  perform pg_temp.check_true((public.claim_subscription_verification(business,'subscription:exhausted')->>'allowed')::boolean,'support can explicitly resume exhausted checks');

  claim := public.claim_subscription_verification(business,'subscription:missing');
  perform public.finish_subscription_verification(business,'subscription:missing',(claim->>'token')::uuid,'not_found',1);
  perform pg_temp.check_true(not (public.claim_subscription_verification(business,'subscription:missing')->>'allowed')::boolean,'404 stays paused for review');
  claim := public.claim_subscription_verification(business,'subscription:forbidden');
  perform public.finish_subscription_verification(business,'subscription:forbidden',(claim->>'token')::uuid,'permission',1);
  perform pg_temp.check_true(not (public.claim_subscription_verification(business,'subscription:forbidden')->>'allowed')::boolean,'403 stays paused for review');
  perform pg_temp.check_true((public.claim_subscription_verification('a0000000-0000-4000-8000-000000000002','subscription:forbidden')->>'allowed')::boolean,'another business has an independent verification state');
  perform pg_temp.check_true(public.resume_subscription_verification(business,'subscription:missing')=1,'support can resume just the reviewed reference');
  perform pg_temp.check_true((public.claim_subscription_verification(business,'subscription:missing')->>'allowed')::boolean,'operator reset permits verification again');
  perform pg_temp.check_true(not (public.claim_subscription_verification(business,'subscription:forbidden')->>'allowed')::boolean,'reset does not clear another reference');
  claim := public.claim_subscription_verification(business,'subscription:crashed');
  update public.subscription_verifications set lease_until=now()-interval '1 second' where business_id=business and provider_reference='subscription:crashed';
  perform pg_temp.check_true((public.claim_subscription_verification(business,'subscription:crashed')->>'allowed')::boolean,'an abandoned lease expires');
  perform pg_temp.check_true((select subscription_tier::text='pro' from public.businesses where id=business),'verification failures never change paid business access');
  perform pg_temp.check_true((select provider_status='authorized' and subscription_tier='pro' from public.business_subscriptions where business_id=business),'verification failures never invalidate the subscription');
end;
$test$;
select pg_temp.check_true(not has_table_privilege('authenticated','public.subscription_verifications','SELECT'),'authenticated cannot read verification metadata');
select pg_temp.check_true(not has_function_privilege('authenticated','public.claim_subscription_verification(uuid,text)','EXECUTE'),'authenticated cannot claim verification leases');
select pg_temp.check_true(not has_function_privilege('anon','public.finish_subscription_verification(uuid,text,uuid,text,integer)','EXECUTE'),'anonymous cannot finish verification');
select pg_temp.check_true(not has_function_privilege('authenticated','public.resume_subscription_verification(uuid,text)','EXECUTE'),'authenticated cannot reset provider pauses');
select pg_temp.check_true(has_function_privilege('service_role','public.claim_subscription_verification(uuid,text)','EXECUTE'),'service role can claim verification');
rollback;
