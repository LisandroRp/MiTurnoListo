-- Run before deploying the public price visibility feature.
-- Existing services continue showing their prices by default.
begin;

alter table public.services
  add column if not exists hide_price_publicly boolean not null default false;

commit;
