-- Apply after employee-day-blocks.sql and before deploying hourly blocks.
-- Existing rows remain full-day blocks because both time columns are null.
begin;

alter table public.business_day_blocks
  add column start_time time without time zone,
  add column end_time time without time zone;

alter table public.business_day_blocks
  add constraint business_day_blocks_time_range_check check (
    (start_time is null and end_time is null)
    or (
      employee_id is not null
      and starts_on = ends_on
      and start_time is not null and end_time is not null
      and start_time < time '24:00'
      and end_time > start_time
      and extract(second from start_time) = 0
      and extract(second from end_time) = 0
    )
  );

commit;
