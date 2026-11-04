-- Run before deploying exceptional availability. Weekly schedules are unchanged.
begin;

create table if not exists public.service_special_availability (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  employee_ids uuid[] not null,
  constraint special_availability_time_order check (start_time < end_time),
  constraint special_availability_employee_count check (cardinality(employee_ids) between 1 and 100)
);

create index if not exists service_special_availability_business_date_idx
  on public.service_special_availability (business_id, date);
create index if not exists service_special_availability_service_date_idx
  on public.service_special_availability (service_id, date);

alter table public.service_special_availability enable row level security;
revoke all on public.service_special_availability from public, anon, authenticated;
grant select on public.service_special_availability to authenticated;
grant all on public.service_special_availability to service_role;

drop policy if exists special_availability_member_read on public.service_special_availability;
create policy special_availability_member_read on public.service_special_availability
  for select to authenticated
  using (exists (
    select 1 from public.business_memberships membership
    where membership.business_id = service_special_availability.business_id
      and membership.user_id = auth.uid()
  ));

commit;
