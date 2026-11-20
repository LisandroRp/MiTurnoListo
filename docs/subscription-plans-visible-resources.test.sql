-- LOCAL TEST DATABASE ONLY. Apply after the original synthetic fixture and migrations 01/02.
alter table public.employees add column if not exists is_public boolean not null default true;
\ir subscription-plans-05-visible-resources.sql

begin;
create or replace function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlerrm like expected then return; end if;
    raise;
  end;
  raise exception 'Expected rejection: %', expected;
end;
$$;
create or replace function pg_temp.expect_true(value boolean, description text) returns void language plpgsql as $$
begin
  if not coalesce(value, false) then raise exception 'Assertion failed: %', description; end if;
end;
$$;
insert into public.businesses(id,name,subscription_tier,pro_limits_enabled)
values ('70000000-0000-4000-8000-000000000001','Local visibility fixture','pro',true),
       ('70000000-0000-4000-8000-000000000002','Local Infinity fixture','unlimited',true);

insert into public.employees(business_id,name,is_public) select '70000000-0000-4000-8000-000000000001','Visible '||n,true from generate_series(1,3) n;
insert into public.employees(id,business_id,name,is_public) values ('70000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000001','Overflow employee',true);
select pg_temp.expect_true((select not is_public and is_active from public.employees where id='70000000-0000-4000-8000-000000000003'),'fourth employee saved hidden and active');
select pg_temp.expect_error($q$update public.employees set is_public=true where id='70000000-0000-4000-8000-000000000003'$q$,'PLAN_LIMIT:%3 empleados visibles%');
select pg_temp.expect_error($q$insert into public.employees(id,business_id,name,is_public) values ('70000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000001','Overflow employee',true) on conflict(id) do update set is_public=excluded.is_public$q$,'PLAN_LIMIT:%');
update public.employees set is_public=false where business_id='70000000-0000-4000-8000-000000000001' and name='Visible 1';
update public.employees set is_public=true where id='70000000-0000-4000-8000-000000000003';
select pg_temp.expect_true((select count(*)=3 from public.employees where business_id='70000000-0000-4000-8000-000000000001' and is_active and is_public),'hiding one employee frees one slot');
insert into public.employees(id,business_id,name,is_public) values ('70000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000001','Edited employee',true) on conflict(id) do update set name=excluded.name,is_public=excluded.is_public;
insert into public.employees(business_id,name,is_public) select '70000000-0000-4000-8000-000000000001','Hidden '||n,false from generate_series(1,5) n;
update public.employees set name='Edited hidden employee' where business_id='70000000-0000-4000-8000-000000000001' and name='Hidden 1';

insert into public.services(business_id,name,is_public) select '70000000-0000-4000-8000-000000000001','Visible '||n,true from generate_series(1,10) n;
insert into public.services(id,business_id,name,is_public) values ('70000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000001','Overflow service',true);
select pg_temp.expect_true((select not is_public and is_active from public.services where id='70000000-0000-4000-8000-000000000004'),'eleventh service saved hidden and active');
select pg_temp.expect_error($q$update public.services set is_public=true where id='70000000-0000-4000-8000-000000000004'$q$,'PLAN_LIMIT:%10 servicios visibles%');
update public.services set is_public=false where business_id='70000000-0000-4000-8000-000000000001' and name='Visible 1';
update public.services set is_public=true where id='70000000-0000-4000-8000-000000000004';
select pg_temp.expect_true((select count(*)=10 from public.services where business_id='70000000-0000-4000-8000-000000000001' and is_active and is_public),'hiding one service frees one slot');
insert into public.services(business_id,name,is_public) select '70000000-0000-4000-8000-000000000001','Hidden '||n,false from generate_series(1,5) n;
insert into public.employees(business_id,name,is_public) select '70000000-0000-4000-8000-000000000002','Infinity '||n,true from generate_series(1,5) n;
select pg_temp.expect_true((select count(*)=5 from public.employees where business_id='70000000-0000-4000-8000-000000000002' and is_public),'Infinity remains unlimited');
insert into public.appointments(business_id,starts_at) select '70000000-0000-4000-8000-000000000001','2099-01-15 10:00:00+00' from generate_series(1,150);
select pg_temp.expect_error($q$insert into public.appointments(business_id,starts_at) values ('70000000-0000-4000-8000-000000000001','2099-01-15 10:00:00+00')$q$,'PLAN_LIMIT:%150 turnos%');

insert into public.businesses(id,name,subscription_tier,pro_limits_enabled)
  values ('70000000-0000-4000-8000-000000000005','Local FREE visibility fixture','free',true);
insert into public.employees(business_id,name,is_public) select '70000000-0000-4000-8000-000000000005','Free employee '||n,true from generate_series(1,3) n;
select pg_temp.expect_true((select count(*)=1 from public.employees where business_id='70000000-0000-4000-8000-000000000005' and is_public),'FREE permits one visible employee and saves extras hidden');
select pg_temp.expect_error($q$update public.employees set is_public=true where business_id='70000000-0000-4000-8000-000000000005' and name='Free employee 2'$q$,'PLAN_LIMIT:%FREE%1 empleados visibles%');
update public.employees set is_public=false where business_id='70000000-0000-4000-8000-000000000005' and is_public;
update public.employees set is_public=true where business_id='70000000-0000-4000-8000-000000000005' and name='Free employee 2';
insert into public.services(business_id,name,is_public) select '70000000-0000-4000-8000-000000000005','Free service '||n,true from generate_series(1,4) n;
select pg_temp.expect_true((select count(*)=2 from public.services where business_id='70000000-0000-4000-8000-000000000005' and is_public),'FREE permits two visible services and saves extras hidden');
select pg_temp.expect_error($q$update public.services set is_public=true where business_id='70000000-0000-4000-8000-000000000005' and name='Free service 3'$q$,'PLAN_LIMIT:%FREE%2 servicios visibles%');
rollback;
