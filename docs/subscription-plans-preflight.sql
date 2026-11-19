-- READ ONLY. One result cell includes all metadata, even when the SQL editor
-- displays only the final statement's result. Copy the complete `preflight` cell.
select jsonb_pretty(jsonb_build_object(
  'subscription_tiers', coalesce((
    select jsonb_agg(e.enumlabel order by e.enumsortorder)
    from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid
    where n.nspname='public' and t.typname='subscription_tier'
  ), '[]'::jsonb),
  'constraints', coalesce((
    select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid)))
    from pg_constraint where conrelid in ('public.businesses'::regclass,'public.business_subscriptions'::regclass,'public.admin_audit_logs'::regclass)
  ), '[]'::jsonb),
  'triggers', coalesce((
    select jsonb_agg(jsonb_build_object('table',tgrelid::regclass::text,'name',tgname,'definition',pg_get_triggerdef(oid)))
    from pg_trigger where not tgisinternal and tgrelid in ('public.businesses'::regclass,'public.employees'::regclass,'public.services'::regclass,'public.appointments'::regclass)
  ), '[]'::jsonb),
  'policies', coalesce((
    select jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'roles',roles,'command',cmd,'using',qual,'check',with_check))
    from pg_policies where schemaname='public' and tablename in ('businesses','business_subscriptions','admin_audit_logs')
  ), '[]'::jsonb),
  'reviewed_business', coalesce((
    select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'tier',b.subscription_tier,
      'has_authorized_subscription',exists(select 1 from public.business_subscriptions s where s.business_id=b.id and s.provider='mercadopago' and s.provider_status='authorized'),
      'latest_manual_action',(select a.action from public.admin_audit_logs a where a.target_business_id=b.id order by a.created_at desc limit 1)))
    from public.businesses b where b.id='90593413-c118-449d-9752-7ee3f5de6daf'
  ), '[]'::jsonb)
)) as preflight;
