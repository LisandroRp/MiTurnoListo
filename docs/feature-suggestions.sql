-- Apply this migration to Supabase before deploying the feature-suggestions screen.
-- Suggestions are only accessed through server routes using the service role.

begin;

create table if not exists public.feature_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  submitted_by_email text not null,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  submission_date date not null,
  status text not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  constraint feature_suggestions_one_per_user_per_day unique (user_id, submission_date),
  constraint feature_suggestions_status_check check (status in ('pending', 'done', 'rejected'))
);

-- These additions keep the migration reusable if the base table was already
-- created before review statuses were introduced.
alter table public.feature_suggestions
  add column if not exists status text not null default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feature_suggestions_status_check'
      and conrelid = 'public.feature_suggestions'::regclass
  ) then
    alter table public.feature_suggestions
      add constraint feature_suggestions_status_check
      check (status in ('pending', 'done', 'rejected'));
  end if;
end
$$;

create index if not exists feature_suggestions_created_at_idx
  on public.feature_suggestions (created_at desc);

alter table public.feature_suggestions enable row level security;

revoke all on table public.feature_suggestions from anon, authenticated;
grant all on table public.feature_suggestions to service_role;

commit;
