-- LOCAL TEST DATABASE ONLY. Never run this fixture against a live Supabase project.
-- Requires an isolated schema fixture and both subscription migrations.
begin;
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Assertion failed: %', label; end if; end $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
declare rejected boolean := false;
begin
  begin execute statement;
  exception when others then
    if sqlerrm not like expected then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Expected rejection: %', expected; end if;
end $$;

insert into auth.users(id,email) values ('10000000-0000-0000-0000-000000000001','admin@example.test');
insert into public.super_admins(user_id) values ('10000000-0000-0000-0000-000000000001');
insert into public.businesses(id,name,subscription_tier,pro_limits_enabled) values
 ('20000000-0000-0000-0000-000000000001','Legacy Pro','pro',false),
 ('20000000-0000-0000-0000-000000000002','Capped Pro','pro',true),
 ('20000000-0000-0000-0000-000000000003','Unlimited','unlimited',true),
 ('20000000-0000-0000-0000-000000000004','Manual','pro',false);

insert into public.employees(business_id) select '20000000-0000-0000-0000-000000000001' from generate_series(1,5);
insert into public.employees(business_id) select '20000000-0000-0000-0000-000000000003' from generate_series(1,5);
insert into public.employees(business_id) select '20000000-0000-0000-0000-000000000002' from generate_series(1,3);
select pg_temp.expect_error($q$insert into public.employees(business_id) values ('20000000-0000-0000-0000-000000000002')$q$, 'PLAN_LIMIT:%3 integrantes%');
update public.employees set name='Still editable' where business_id='20000000-0000-0000-0000-000000000002';
insert into public.employees(business_id,is_active) values ('20000000-0000-0000-0000-000000000002',false);
select pg_temp.expect_error($q$update public.employees set is_active=true where business_id='20000000-0000-0000-0000-000000000002' and not is_active$q$, 'PLAN_LIMIT:%');

insert into public.services(business_id,is_public) select '20000000-0000-0000-0000-000000000002',false from generate_series(1,10);
select pg_temp.expect_error($q$insert into public.services(business_id,is_public) values ('20000000-0000-0000-0000-000000000002',false)$q$, 'PLAN_LIMIT:%10 servicios%');
update public.services set name='Still editable' where business_id='20000000-0000-0000-0000-000000000002';

insert into public.appointments(business_id,starts_at) select '20000000-0000-0000-0000-000000000002','2027-01-31 23:00:00-03' from generate_series(1,150);
select pg_temp.expect_error($q$insert into public.appointments(business_id,starts_at) values ('20000000-0000-0000-0000-000000000002','2027-02-01 02:30:00+00')$q$, 'PLAN_LIMIT:%150 turnos%');
insert into public.appointments(business_id,starts_at) values ('20000000-0000-0000-0000-000000000002','2027-02-01 03:00:00+00');
insert into public.appointments(business_id,starts_at,appointment_status) values ('20000000-0000-0000-0000-000000000002','2027-01-10 10:00:00-03','cancelled');
update public.appointments set appointment_status='completed' where business_id='20000000-0000-0000-0000-000000000002' and appointment_status='scheduled';
select pg_temp.expect_error($q$update public.appointments set appointment_status='scheduled' where business_id='20000000-0000-0000-0000-000000000002' and appointment_status='cancelled'$q$, 'PLAN_LIMIT:%');

insert into public.appointments(business_id,starts_at,rescheduled_from_appointment_id)
select business_id,'2027-01-20 10:00:00-03',id from public.appointments
where business_id='20000000-0000-0000-0000-000000000002' and starts_at='2027-01-31 23:00:00-03' limit 1;
select pg_temp.assert_true((select count(*)=150 from public.appointments where business_id='20000000-0000-0000-0000-000000000002' and starts_at<'2027-02-01 03:00:00+00' and appointment_status not in ('cancelled','rescheduled')), 'same-month rescheduling consumes one slot');
select pg_temp.expect_error($q$insert into public.appointments(business_id,starts_at,rescheduled_from_appointment_id) select '20000000-0000-0000-0000-000000000002','2027-01-20 10:00:00-03',rescheduled_from_appointment_id from public.appointments where rescheduled_from_appointment_id is not null limit 1$q$, 'Invalid rescheduling source.');

select public.set_manual_business_plan('20000000-0000-0000-0000-000000000004','unlimited','10000000-0000-0000-0000-000000000001','admin@example.test');
update public.businesses set subscription_tier='free' where id='20000000-0000-0000-0000-000000000004';
select pg_temp.assert_true((select subscription_tier='unlimited' and manual_subscription_tier='unlimited' from public.businesses where id='20000000-0000-0000-0000-000000000004'), 'manual Unlimited survives status and referral reconciliation');
select pg_temp.assert_true(public.reconcile_business_subscription('20000000-0000-0000-0000-000000000004')='unlimited', 'provider reconciliation preserves manual grants');
select pg_temp.assert_true((select count(*)=1 from public.admin_audit_logs where target_business_id='20000000-0000-0000-0000-000000000004' and action='activateUnlimited'), 'manual changes are audited');
select pg_temp.expect_error($q$select public.set_manual_business_plan('20000000-0000-0000-0000-000000000004','pro','10000000-0000-0000-0000-000000000002','nobody@example.test')$q$, 'Super admin access required.');
select pg_temp.expect_error($q$select public.set_manual_business_plan('20000000-0000-0000-0000-000000000004','pro','10000000-0000-0000-0000-000000000001','wrong@example.test')$q$, 'Invalid audit actor.');
insert into public.business_subscriptions(business_id,subscription_tier,provider_status,provider_subscription_id) values ('20000000-0000-0000-0000-000000000004','unlimited','authorized','local-test-subscription');
select pg_temp.expect_error($q$select public.set_manual_business_plan('20000000-0000-0000-0000-000000000004','free','10000000-0000-0000-0000-000000000001','admin@example.test')$q$, 'Manage the active paid subscription%');

select pg_temp.assert_true(public.reconcile_business_subscription('20000000-0000-0000-0000-000000000004')='unlimited', 'authorized Unlimited is recognized');

-- Test atomicity: a failed audit insert must roll back the entitlement change.
alter table public.admin_audit_logs add constraint test_audit_reject check (action <> 'downgradeFree') not valid;
select pg_temp.expect_error($q$select public.set_manual_business_plan('20000000-0000-0000-0000-000000000001','free','10000000-0000-0000-0000-000000000001','admin@example.test')$q$, '%test_audit_reject%');
select pg_temp.assert_true((select subscription_tier='pro' from public.businesses where id='20000000-0000-0000-0000-000000000001'), 'audit failure rolls back tier changes');

grant usage on schema public to authenticated;
grant select, update on public.businesses to authenticated;
set local role authenticated;
select pg_temp.expect_error($q$update public.businesses set manual_subscription_tier='unlimited' where id='20000000-0000-0000-0000-000000000001'$q$, 'Plan fields can only be changed by the server.');
select pg_temp.expect_error($q$update public.businesses set subscription_tier='unlimited' where id='20000000-0000-0000-0000-000000000001'$q$, 'Plan fields can only be changed by the server.');
reset role;

select pg_temp.assert_true(not has_function_privilege('authenticated','public.set_manual_business_plan(uuid,text,uuid,text)','EXECUTE'), 'authenticated clients cannot grant plans');
select pg_temp.assert_true(has_function_privilege('service_role','public.set_manual_business_plan(uuid,text,uuid,text)','EXECUTE'), 'server can grant manual plans');
rollback;
