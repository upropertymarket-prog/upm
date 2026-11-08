-- ===========================================================================
-- Leads do site: confirmado ou por confirmar (cliente, 8 nov 2026)
-- ===========================================================================
-- A lista do interno não distinguia quem confirmou o e-mail de quem não
-- confirmou — e é a informação que mais conta para quem vai contactar. As
-- três funções do Admin passam a devolver `confirmed_at`; a lista e a
-- exportação aceitam `p_confirmed` (null = todos, true = confirmados,
-- false = por confirmar).
--
-- Mudam o tipo de retorno, por isso saem e voltam (`drop` + `create`), com os
-- mesmos grants. E voltam com `set search_path = ''`, a regra de todas as
-- funções `security definer` (a versão de 2 out ainda tinha `public`).
--
-- Lembrete do que já existe e a nota do ecrã repete: `run_retention` apaga
-- todos os dias os por confirmar com mais de 30 dias
-- (`purge_unconfirmed_site_leads`) e os parados há 12 meses que não foram
-- convertidos (`purge_stale_site_leads`).
-- ===========================================================================

drop function if exists public.admin_list_site_leads(text, text, text, uuid, text, timestamptz, uuid, text, integer);
drop function if exists public.admin_site_lead_detail(uuid);
drop function if exists public.admin_export_site_leads(text, text, text, uuid, text);

create function public.admin_list_site_leads(
  p_status text default null,
  p_source text default null,
  p_form text default null,
  p_assigned_to uuid default null,
  p_search text default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_direction text default 'next',
  p_limit integer default 25,
  p_confirmed boolean default null
)
returns table (
  id uuid, source text, form text, name text, email text, phone text, profile_type text,
  reason text, status text, assigned_to uuid, assigned_name text, consent_marketing boolean,
  confirmed_at timestamptz, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
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
      and (p_confirmed is null or (l.confirmed_at is not null) = p_confirmed)
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
    f.status,f.assigned_to,f.assignee_name,f.consent_marketing,f.confirmed_at,f.created_at
  from filtered f
  order by f.created_at desc,f.id desc;
end;
$$;

create function public.admin_site_lead_detail(p_lead_id uuid)
returns table (
  id uuid, source text, form text, name text, email text, phone text, profile_type text,
  reason text, message text, utm jsonb, status text, assigned_to uuid, assigned_name text,
  consent_marketing boolean, consent_at timestamptz, confirmed_at timestamptz,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Sem permissao' using errcode = '42501'; end if;
  return query select l.id,l.source,l.form,l.name,l.email,l.phone,l.profile_type,l.reason,
    l.message,l.utm,l.status,l.assigned_to,pr.full_name,l.consent_marketing,l.consent_at,
    l.confirmed_at,l.created_at,l.updated_at
  from public.site_leads l left join public.profiles pr on pr.id=l.assigned_to where l.id=p_lead_id;
end;
$$;

create function public.admin_export_site_leads(
  p_status text default null,
  p_source text default null,
  p_form text default null,
  p_assigned_to uuid default null,
  p_search text default null,
  p_confirmed boolean default null
)
returns table (
  source text, form text, name text, email text, phone text, profile_type text, reason text,
  message text, utm jsonb, status text, assigned_name text, consent_marketing boolean,
  consent_at timestamptz, confirmed_at timestamptz, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Sem permissao' using errcode='42501'; end if;
  if length(coalesce(p_search,'')) > 120 then raise exception 'Pesquisa demasiado longa' using errcode='22023'; end if;
  return query select l.source,l.form,l.name,l.email,l.phone,l.profile_type,l.reason,l.message,l.utm,l.status,
    p.full_name,l.consent_marketing,l.consent_at,l.confirmed_at,l.created_at
  from public.site_leads l left join public.profiles p on p.id=l.assigned_to
  where (p_status is null or l.status=p_status) and (p_source is null or l.source=p_source)
    and (p_form is null or l.form=p_form) and (p_assigned_to is null or l.assigned_to=p_assigned_to)
    and (p_confirmed is null or (l.confirmed_at is not null) = p_confirmed)
    and (nullif(btrim(p_search),'') is null or strpos(lower(l.name),lower(btrim(p_search)))>0 or strpos(lower(l.email),lower(btrim(p_search)))>0)
  order by l.created_at desc,l.id desc limit 5000;
end;
$$;

revoke all on function public.admin_list_site_leads(text,text,text,uuid,text,timestamptz,uuid,text,integer,boolean) from public, anon;
revoke all on function public.admin_site_lead_detail(uuid) from public, anon;
revoke all on function public.admin_export_site_leads(text,text,text,uuid,text,boolean) from public, anon;
grant execute on function public.admin_list_site_leads(text,text,text,uuid,text,timestamptz,uuid,text,integer,boolean) to authenticated;
grant execute on function public.admin_site_lead_detail(uuid) to authenticated;
grant execute on function public.admin_export_site_leads(text,text,text,uuid,text,boolean) to authenticated;
