-- P8-01: one bounded server aggregation for the Admin landing page and sidebar.
alter table public.properties add column submitted_at timestamptz;
create index properties_submitted_at_idx on public.properties (submitted_at desc) where submitted_at is not null;
create or replace function public.mark_property_submitted_at()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.status='pending_review' and (tg_op='INSERT' or old.status is distinct from new.status) then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;
create trigger properties_mark_submitted_at before insert or update of status on public.properties
  for each row execute function public.mark_property_submitted_at();
create index audit_log_admin_activity_idx on public.audit_log (created_at desc)
  where action in (
    'property.approved','property.rejected','property.featured','property.unfeatured','property.reopened',
    'profile.suspended','profile.reactivated','site_lead.status','site_lead.assignment',
    'plan.updated','plan.created','settings.feature_flag','settings.company','site_leads.export'
  );

create or replace function public.admin_dashboard_metrics()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_payload jsonb;
begin
  if not public.is_admin() then raise exception 'Sem permissao' using errcode='42501'; end if;
  with days as (
    select d.day::date as date from generate_series(current_date - 29, current_date, interval '1 day') as d(day)
  ), registrations as (
    select created_at::date as date,count(*)::bigint as total from public.profiles
    where created_at >= current_date - 29 and created_at < current_date + 1 and role in ('buyer','owner')
    group by created_at::date
  ), submissions as (
    select submitted_at::date as date,count(*)::bigint as total from public.properties
    where submitted_at >= current_date - 29 and submitted_at < current_date + 1
    group by submitted_at::date
  ), daily as (
    select d.date,coalesce(r.total,0)::bigint as registrations,coalesce(s.total,0)::bigint as properties_submitted
    from days d left join registrations r using(date) left join submissions s using(date)
  ), activity as (
    select jsonb_agg(jsonb_build_object(
      'action', case a.action
        when 'property.approved' then 'property_approved'
        when 'property.rejected' then 'property_rejected'
        when 'property.featured' then 'property_featured'
        when 'property.unfeatured' then 'property_unfeatured'
        when 'property.reopened' then 'property_reopened'
        when 'profile.suspended' then 'profile_status'
        when 'profile.reactivated' then 'profile_status'
        when 'site_lead.status' then 'lead_status'
        when 'site_lead.assignment' then 'lead_assignment'
        when 'plan.updated' then 'plan_updated'
        when 'plan.created' then 'plan_updated'
        when 'settings.feature_flag' then 'settings_updated'
        when 'settings.company' then 'settings_updated'
        when 'site_leads.export' then 'leads_exported'
        else null
      end,
      'entity', case a.entity when 'properties' then 'property' when 'profiles' then 'user' when 'site_leads' then 'lead' when 'plans' then 'plan' else 'settings' end,
      'created_at', a.created_at
    ) order by a.created_at desc) as items
    from (
      select l.action,l.entity,l.created_at from public.audit_log l
      where l.action in ('property.approved','property.rejected','property.featured','property.unfeatured','property.reopened','profile.suspended','profile.reactivated','site_lead.status','site_lead.assignment','plan.updated','plan.created','settings.feature_flag','settings.company','site_leads.export')
      order by l.created_at desc limit 10
    ) a
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'users_total',(select count(*) from public.profiles),
      'users_new_30d',(select count(*) from public.profiles where created_at >= now()-interval '30 days'),
      'buyers',(select count(*) from public.profiles where role='buyer'),
      'owners',(select count(*) from public.profiles where role='owner'),
      'active_properties',(select count(*) from public.properties where status='active'),
      'featured_properties',(select count(*) from public.properties where status='featured'),
      'pending_moderation',(select count(*) from public.properties where status='pending_review'),
      'new_leads',(select count(*) from public.site_leads where status='new')
    ),
    'daily',(select coalesce(jsonb_agg(to_jsonb(d) order by d.date),'[]'::jsonb) from daily d),
    'activity',(select coalesce(items,'[]'::jsonb) from activity)
  ) into v_payload;
  return v_payload;
end;
$$;
revoke all on function public.admin_dashboard_metrics() from public,anon;
grant execute on function public.admin_dashboard_metrics() to authenticated;
comment on function public.admin_dashboard_metrics() is 'Bounded Admin overview aggregates; excludes personal activity details.';
