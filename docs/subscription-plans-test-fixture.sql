-- LOCAL TEST DATABASE ONLY. Synthetic fixture based on inspected schema metadata.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create table auth.users(id uuid primary key, email text);
create type public.subscription_tier as enum ('free','pro');
create type public.appointment_status as enum ('pending','confirmed','cancelled');
create type public.appointment_lifecycle_status as enum ('scheduled','cancelled','rescheduled','no_show','completed');
create table public.businesses(id uuid primary key default gen_random_uuid(), name text, subscription_tier public.subscription_tier not null default 'free', timezone text default 'America/Argentina/Buenos_Aires');
create table public.super_admins(user_id uuid primary key);
create table public.business_subscriptions(id uuid primary key default gen_random_uuid(), business_id uuid references public.businesses(id), provider text default 'mercadopago', subscription_tier text check(subscription_tier in ('free','pro')), provider_status text, provider_subscription_id text);
create table public.admin_audit_logs(id uuid primary key default gen_random_uuid(), actor_user_id uuid, actor_email text, target_business_id uuid references public.businesses(id), action text, previous_value jsonb, next_value jsonb, created_at timestamptz default now());
create table public.employees(id uuid primary key default gen_random_uuid(), business_id uuid references public.businesses(id), name text, is_active boolean default true);
create table public.services(id uuid primary key default gen_random_uuid(), business_id uuid references public.businesses(id), name text, is_active boolean default true, is_public boolean default true);
create table public.appointments(id uuid primary key default gen_random_uuid(), business_id uuid references public.businesses(id), starts_at timestamptz not null, appointment_status public.appointment_lifecycle_status default 'scheduled', status public.appointment_status default 'confirmed', rescheduled_from_appointment_id uuid references public.appointments(id));
