-- LOCAL TEST DATABASE ONLY. Requires migrations 01/02 and activation script 04.
begin;
create or replace function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Assertion failed: %', label; end if; end $$;
create or replace function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
declare rejected boolean := false;
begin
  begin execute statement;
  exception when others then if sqlerrm not like expected then raise; end if; rejected := true; end;
  if not rejected then raise exception 'Expected rejection: %', expected; end if;
end $$;

insert into public.businesses(id,name,subscription_tier,pro_limits_enabled)
values ('70000000-0000-0000-0000-000000000001','Explicit false cannot bypass full release','free',false);
select pg_temp.assert_true((select pro_limits_enabled from public.businesses where id='70000000-0000-0000-0000-000000000001'), 'new businesses get quotas even with explicit false');
update public.businesses set subscription_tier='pro' where id='70000000-0000-0000-0000-000000000001';
insert into public.employees(business_id) select '70000000-0000-0000-0000-000000000001' from generate_series(1,3);
select pg_temp.expect_error($q$insert into public.employees(business_id) values ('70000000-0000-0000-0000-000000000001')$q$, 'PLAN_LIMIT:%');

insert into public.businesses(id,name,subscription_tier)
values ('70000000-0000-0000-0000-000000000002','Default enabled','free');
select pg_temp.assert_true((select pro_limits_enabled from public.businesses where id='70000000-0000-0000-0000-000000000002'), 'omitted flag defaults to enabled');
insert into public.employees(business_id) select '70000000-0000-0000-0000-000000000002' from generate_series(1,4);
update public.businesses set subscription_tier='unlimited' where id='70000000-0000-0000-0000-000000000002';
insert into public.employees(business_id) select '70000000-0000-0000-0000-000000000002' from generate_series(1,4);

-- Authenticated signup remains possible with the new default. Plan changes remain server-only.
grant usage on schema public to authenticated;
grant insert, select, update on public.businesses to authenticated;
set local role authenticated;
insert into public.businesses(id,name) values ('70000000-0000-0000-0000-000000000003','Authenticated signup');
select pg_temp.assert_true((select pro_limits_enabled from public.businesses where id='70000000-0000-0000-0000-000000000003'), 'authenticated signup accepts the enabled default');
select pg_temp.expect_error($q$update public.businesses set pro_limits_enabled=false where id='70000000-0000-0000-0000-000000000003'$q$, 'Plan fields can only be changed by the server.');
select pg_temp.expect_error($q$update public.businesses set subscription_tier='unlimited' where id='70000000-0000-0000-0000-000000000003'$q$, 'Plan fields can only be changed by the server.');
reset role;

-- Server rollback of quota activation remains available per business.
update public.businesses set pro_limits_enabled=false where id='70000000-0000-0000-0000-000000000001';
insert into public.employees(business_id) values ('70000000-0000-0000-0000-000000000001');
rollback;
