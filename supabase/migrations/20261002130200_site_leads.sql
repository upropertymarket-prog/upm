-- P8-04: private site-lead CRM. Public form ingestion remains P2-02.
create table public.site_leads (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('pre_launch', 'post_launch')),
  form text not null check (form in ('preinscricao', 'contacto', 'empresas')),
  name text not null check (length(btrim(name)) between 1 and 160),
  email text not null check (length(email) between 3 and 320),
  phone text check (phone is null or length(phone) <= 40),
  profile_type text not null check (profile_type in ('owner', 'buyer', 'empresa')),
  reason text check (reason is null or length(reason) <= 160),
  message text check (message is null or length(message) <= 5000),
  utm jsonb not null default '{}'::jsonb check (jsonb_typeof(utm) = 'object'),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'converted', 'discarded')),
  assigned_to uuid references public.profiles (id) on delete set null,
  consent_marketing boolean not null default false,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_leads_consent_timestamp check (consent_marketing = (consent_at is not null))
);
create index site_leads_status_created_idx on public.site_leads (status, created_at desc, id desc);
create index site_leads_source_created_idx on public.site_leads (source, created_at desc, id desc);
create index site_leads_form_created_idx on public.site_leads (form, created_at desc, id desc);
create index site_leads_assigned_created_idx on public.site_leads (assigned_to, created_at desc, id desc);
create index site_leads_email_idx on public.site_leads (lower(email));
create trigger site_leads_set_updated_at before update on public.site_leads
  for each row execute function public.set_updated_at();

create table public.site_lead_events (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.site_leads (id) on delete restrict,
  kind text not null check (kind in ('status', 'assignment', 'note')),
  body text not null check (length(body) between 1 and 2000),
  actor_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index site_lead_events_lead_idx on public.site_lead_events (lead_id, created_at desc, id desc);
create index site_lead_events_actor_idx on public.site_lead_events (actor_id);

alter table public.site_leads enable row level security;
alter table public.site_lead_events enable row level security;
create policy site_leads_admin_select on public.site_leads for select using (public.is_admin());
create policy site_lead_events_admin_select on public.site_lead_events for select using (public.is_admin());
revoke all on public.site_leads, public.site_lead_events from anon, authenticated;
grant select on public.site_leads, public.site_lead_events to authenticated;
revoke all on sequence public.site_lead_events_id_seq from anon, authenticated;
comment on table public.site_leads is 'Site prospects; private to Admin. Public ingestion is delivered in P2-02.';
comment on table public.site_lead_events is 'Append-only lead status, assignment, and note history.';

create or replace function public.admin_list_site_leads(
  p_status text default null,
  p_source text default null,
  p_form text default null,
  p_assigned_to uuid default null,
  p_search text default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_direction text default 'next',
  p_limit integer default 25
)
returns table (
  id uuid, source text, form text, name text, email text, phone text,
  profile_type text, reason text, status text, assigned_to uuid,
  assigned_name text, consent_marketing boolean, created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  if not public.is_admin() then raise exception 'Sem permissao' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('new','contacted','qualified','converted','discarded') then raise exception 'Estado invalido' using errcode = '22023'; end if;
  if p_source is not null and p_source not in ('pre_launch','post_launch') then raise exception 'Fonte invalida' using errcode = '22023'; end if;
  if p_form is not null and p_form not in ('preinscricao','contacto','empresas') then raise exception 'Formulario invalido' using errcode = '22023'; end if;
  if (p_cursor_created_at is null) <> (p_cursor_id is null) then raise exception 'Cursor invalido' using errcode = '22023'; end if;
  if p_direction not in ('next','prev') then raise exception 'Direcao invalida' using errcode = '22023'; end if;
  if length(coalesce(p_search,'')) > 120 then raise exception 'Pesquisa demasiado longa' using errcode = '22023'; end if;
  return query
  with filtered as (
    select l.*, pr.full_name as assignee_name
    from public.site_leads l left join public.profiles pr on pr.id = l.assigned_to
    where (p_status is null or l.status = p_status)
      and (p_source is null or l.source = p_source)
      and (p_form is null or l.form = p_form)
      and (p_assigned_to is null or l.assigned_to = p_assigned_to)
      and (nullif(btrim(p_search),'') is null or
        strpos(lower(l.name),lower(btrim(p_search)))>0 or strpos(lower(l.email),lower(btrim(p_search)))>0)
      and (p_cursor_id is null or
        (p_direction = 'next' and (l.created_at,l.id) < (p_cursor_created_at,p_cursor_id)) or
        (p_direction = 'prev' and (l.created_at,l.id) > (p_cursor_created_at,p_cursor_id)))
    order by case when p_direction = 'prev' then l.created_at end asc,
      case when p_direction = 'prev' then l.id end asc,
      case when p_direction = 'next' then l.created_at end desc,
      case when p_direction = 'next' then l.id end desc
    limit v_limit
  )
  select f.id,f.source,f.form,f.name,f.email,f.phone,f.profile_type,f.reason,
    f.status,f.assigned_to,f.assignee_name,f.consent_marketing,f.created_at
  from filtered f
  order by f.created_at desc,f.id desc;
end;
$$;

create or replace function public.admin_site_lead_detail(p_lead_id uuid)
returns table (
  id uuid, source text, form text, name text, email text, phone text, profile_type text,
  reason text, message text, utm jsonb, status text, assigned_to uuid, assigned_name text,
  consent_marketing boolean, consent_at timestamptz, created_at timestamptz, updated_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Sem permissao' using errcode = '42501'; end if;
  return query select l.id,l.source,l.form,l.name,l.email,l.phone,l.profile_type,l.reason,
    l.message,l.utm,l.status,l.assigned_to,pr.full_name,l.consent_marketing,l.consent_at,l.created_at,l.updated_at
  from public.site_leads l left join public.profiles pr on pr.id=l.assigned_to where l.id=p_lead_id;
end;
$$;

create or replace function public.admin_site_lead_history(p_lead_id uuid)
returns table (id bigint, kind text, body text, actor_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Sem permissao' using errcode = '42501'; end if;
  if not exists(select 1 from public.site_leads l where l.id=p_lead_id) then return; end if;
  return query select e.id,e.kind,e.body,coalesce(nullif(p.full_name,''),'Admin'),e.created_at
    from public.site_lead_events e join public.profiles p on p.id=e.actor_id
    where e.lead_id=p_lead_id order by e.created_at desc,e.id desc limit 100;
end;
$$;

create or replace function public.admin_site_lead_staff()
returns table (id uuid, full_name text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Sem permissao' using errcode = '42501'; end if;
  return query select p.id,coalesce(nullif(p.full_name,''),p.id::text)
    from public.profiles p where p.role='admin' order by p.full_name,p.id;
end;
$$;

create or replace function public.admin_update_site_lead(p_lead_id uuid,p_status text,p_assigned_to uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_lead public.site_leads%rowtype;
begin
  if not public.is_admin() then raise exception 'Sem permissao' using errcode='42501'; end if;
  if p_status is not null and p_status not in ('new','contacted','qualified','converted','discarded') then raise exception 'Estado invalido' using errcode='22023'; end if;
  if p_assigned_to is not null and not exists(select 1 from public.profiles p where p.id=p_assigned_to and p.role='admin') then raise exception 'Responsavel invalido' using errcode='22023'; end if;
  select * into v_lead from public.site_leads where id=p_lead_id for update;
  if not found then raise exception 'Lead nao encontrada' using errcode='P0002'; end if;
  if p_status is distinct from v_lead.status then
    update public.site_leads set status=p_status where id=p_lead_id;
    insert into public.site_lead_events(lead_id,kind,body,actor_id) values(p_lead_id,'status',v_lead.status||' -> '||p_status,auth.uid());
    perform public.write_audit_log('site_lead.status','site_leads',p_lead_id,jsonb_build_object('before',v_lead.status,'after',p_status));
  end if;
  if p_assigned_to is distinct from v_lead.assigned_to then
    update public.site_leads set assigned_to=p_assigned_to where id=p_lead_id;
    insert into public.site_lead_events(lead_id,kind,body,actor_id) values(p_lead_id,'assignment',coalesce(p_assigned_to::text,'unassigned'),auth.uid());
    perform public.write_audit_log('site_lead.assignment','site_leads',p_lead_id,jsonb_build_object('before',v_lead.assigned_to,'after',p_assigned_to));
  end if;
end;
$$;

create or replace function public.admin_add_site_lead_note(p_lead_id uuid,p_note text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Sem permissao' using errcode='42501'; end if;
  if length(btrim(coalesce(p_note,''))) not between 1 and 2000 then raise exception 'Nota invalida' using errcode='22023'; end if;
  if not exists(select 1 from public.site_leads l where l.id=p_lead_id) then raise exception 'Lead nao encontrada' using errcode='P0002'; end if;
  insert into public.site_lead_events(lead_id,kind,body,actor_id) values(p_lead_id,'note',btrim(p_note),auth.uid());
end;
$$;

create or replace function public.admin_export_site_leads(p_status text default null,p_source text default null,p_form text default null,p_assigned_to uuid default null,p_search text default null)
returns table (source text,form text,name text,email text,phone text,profile_type text,reason text,message text,utm jsonb,status text,assigned_name text,consent_marketing boolean,consent_at timestamptz,created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Sem permissao' using errcode='42501'; end if;
  if length(coalesce(p_search,'')) > 120 then raise exception 'Pesquisa demasiado longa' using errcode='22023'; end if;
  return query select l.source,l.form,l.name,l.email,l.phone,l.profile_type,l.reason,l.message,l.utm,l.status,
    p.full_name,l.consent_marketing,l.consent_at,l.created_at
  from public.site_leads l left join public.profiles p on p.id=l.assigned_to
  where (p_status is null or l.status=p_status) and (p_source is null or l.source=p_source)
    and (p_form is null or l.form=p_form) and (p_assigned_to is null or l.assigned_to=p_assigned_to)
    and (nullif(btrim(p_search),'') is null or strpos(lower(l.name),lower(btrim(p_search)))>0 or strpos(lower(l.email),lower(btrim(p_search)))>0)
  order by l.created_at desc,l.id desc limit 5000;
end;
$$;

revoke all on function public.admin_list_site_leads(text,text,text,uuid,text,timestamptz,uuid,text,integer) from public,anon;
revoke all on function public.admin_site_lead_detail(uuid) from public,anon;
revoke all on function public.admin_site_lead_history(uuid) from public,anon;
revoke all on function public.admin_site_lead_staff() from public,anon;
revoke all on function public.admin_update_site_lead(uuid,text,uuid) from public,anon;
revoke all on function public.admin_add_site_lead_note(uuid,text) from public,anon;
revoke all on function public.admin_export_site_leads(text,text,text,uuid,text) from public,anon;
grant execute on function public.admin_list_site_leads(text,text,text,uuid,text,timestamptz,uuid,text,integer) to authenticated;
grant execute on function public.admin_site_lead_detail(uuid),public.admin_site_lead_history(uuid),public.admin_site_lead_staff() to authenticated;
grant execute on function public.admin_update_site_lead(uuid,text,uuid),public.admin_add_site_lead_note(uuid,text) to authenticated;
grant execute on function public.admin_export_site_leads(text,text,text,uuid,text) to authenticated;
