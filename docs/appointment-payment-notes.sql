-- Apply once in Supabase before using editable manual payment confirmation.
-- No existing appointment amounts or payment statuses are changed.
begin;

alter table public.appointments
  add column if not exists payment_note text;

alter table public.appointments
  drop constraint if exists appointments_payment_note_length;
alter table public.appointments
  add constraint appointments_payment_note_length
  check (payment_note is null or char_length(payment_note) <= 1000);

comment on column public.appointments.payment_note is
  'Optional internal comment recorded when adjusting a manually confirmed payment.';

commit;
