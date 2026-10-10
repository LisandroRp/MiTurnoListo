-- Apply this migration to Supabase before deploying the employee day-block feature.
-- A null employee_id keeps the existing whole-business block behavior.

begin;

alter table public.business_day_blocks
  add column employee_id uuid;

-- The composite foreign key prevents a block from targeting an employee
-- that belongs to a different business.
create unique index employees_business_id_id_for_day_blocks
  on public.employees (business_id, id);

alter table public.business_day_blocks
  add constraint business_day_blocks_employee_business_fkey
  foreign key (business_id, employee_id)
  references public.employees (business_id, id)
  on delete cascade;

create index business_day_blocks_scope_dates_idx
  on public.business_day_blocks (business_id, employee_id, starts_on, ends_on);

commit;
