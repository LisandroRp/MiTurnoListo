-- Apply in Supabase before using saved message templates.
begin;

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);

create index if not exists message_templates_business_idx on public.message_templates (business_id, created_at desc);
alter table public.message_templates enable row level security;
revoke all on public.message_templates from anon;
grant select, insert, update, delete on public.message_templates to authenticated;

drop policy if exists message_templates_business_access on public.message_templates;
create policy message_templates_business_access on public.message_templates
  for all to authenticated
  using (exists (
    select 1 from public.business_memberships membership
    where membership.business_id = message_templates.business_id and membership.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.business_memberships membership
    where membership.business_id = message_templates.business_id and membership.user_id = (select auth.uid())
  ));

commit;
