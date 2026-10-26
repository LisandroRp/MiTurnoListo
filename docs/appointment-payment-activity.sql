-- Apply before deploying activity-based appointment sorting.
-- Existing payment dates remain unknown; creation dates are used as fallback.
begin;

alter table public.appointments
  add column if not exists payment_confirmed_at timestamptz;

create or replace function public.record_appointment_payment_confirmation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.payment_status = 'paid' then
      new.payment_confirmed_at := coalesce(new.payment_confirmed_at, now());
    else
      new.payment_confirmed_at := null;
    end if;
  elsif new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    new.payment_confirmed_at := now();
  else
    new.payment_confirmed_at := old.payment_confirmed_at;
  end if;
  return new;
end;
$$;

revoke all on function public.record_appointment_payment_confirmation() from public;

drop trigger if exists record_appointment_payment_confirmation on public.appointments;
create trigger record_appointment_payment_confirmation
before insert or update on public.appointments
for each row execute function public.record_appointment_payment_confirmation();

commit;
