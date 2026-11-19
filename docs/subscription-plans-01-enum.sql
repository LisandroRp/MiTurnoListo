-- Prepared only. Apply this file separately and commit before file 02.
-- Schema metadata confirmed public.businesses.subscription_tier uses this enum.
alter type public.subscription_tier add value if not exists 'unlimited';
