-- ---------------------------------------------------------------------------
-- Leituras do Suporte, notificação ao reporter e o KPI do Admin (P10-02)
-- ===========================================================================
-- `20261007130000` deu a escrita; esta dá as leituras, e cada uma devolve
-- **exactamente** o que o seu ecrã mostra. Não há um `select *` em tickets
-- nesta fase, e a razão é de privacidade e não de performance:
--
--   - `support_list_tickets` e `support_ticket_detail` veem tudo, incluindo
--     `breadcrumbs` e `console_errors` — é o Suporte, e é esse o trabalho.
--   - `my_reports` **não devolve uma única coluna técnica**. Quem reportou vê
--     a referência, o estado, a gravidade e o "o que foi corrigido". Não vê o
--     `fingerprint` (que diria com que outros tickets o seu foi fundido), nem
--     `affected_users` (que diria quantas outras pessoas têm o mesmo
--     problema), nem a trilha de cliques que ele próprio enviou — que já não
--     lhe acrescenta nada e é dado pessoal a mais a passar pela rede.
--
-- A RLS de `tickets` já impediria a leitura alheia; estas funções são a
-- segunda camada, a que decide **que colunas** cada papel vê. 08 §7.3 pede as
-- duas.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- support_list_tickets — as quatro tabs de 04 §2.6
--
-- As tabs vêm de 07 §5.11: "Por tratar" junta `new` e `triage`. O mapeamento
-- vive aqui, e não no componente, porque a contagem do badge e a lista têm de
-- concordar — e concordam por serem a mesma consulta.
-- ---------------------------------------------------------------------------

create or replace function public.support_list_tickets(
  p_tab text default 'pending',
  p_search text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  ref text,
  title text,
  severity public.ticket_severity,
  status public.ticket_status,
  origin public.ticket_origin,
  route text,
  occurrences integer,
  affected_users integer,
  last_seen_at timestamptz,
  reporter_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_statuses public.ticket_status[];
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.is_staff() then
    raise exception 'not_staff' using hint = 'not_staff';
  end if;

  v_statuses := case p_tab
    when 'pending' then array['new', 'triage']::public.ticket_status[]
    when 'inProgress' then array['in_progress']::public.ticket_status[]
    when 'awaitingConfirmation' then array['awaiting_confirmation']::public.ticket_status[]
    when 'closed' then array['closed']::public.ticket_status[]
    else array['new', 'triage']::public.ticket_status[]
  end;

  return query
  select
    t.id, t.ref, t.title, t.severity, t.status, t.origin, t.route,
    t.occurrences, t.affected_users, t.last_seen_at,
    coalesce(p.full_name, '—') as reporter_name
  from public.tickets t
  left join public.profiles p on p.id = t.reporter_id
  where t.status = any(v_statuses)
    and (
      v_search is null
      -- Pela referência ou pelo título. Nunca pela descrição: procurar no
      -- texto livre de um relato é procurar dentro do que a pessoa escreveu,
      -- e o `strpos` em Seq Scan de D47 já mostrou onde isso acaba.
      or t.ref ilike '%' || v_search || '%'
      or t.title ilike '%' || v_search || '%'
    )
  order by
    -- Crítico primeiro, depois o mais recente. Uma lista de tickets ordenada
    -- só por data enterra o crítico de ontem debaixo do trivial de hoje.
    case t.severity
      when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3
    end,
    t.last_seen_at desc
  limit greatest(least(coalesce(p_limit, 50), 200), 1);
end;
$$;

revoke all on function public.support_list_tickets(text, text, integer) from public, anon;
grant execute on function public.support_list_tickets(text, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- support_ticket_counts — os contadores coloridos das tabs (04 §1.6)
-- ---------------------------------------------------------------------------

create or replace function public.support_ticket_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'not_staff' using hint = 'not_staff';
  end if;

  return jsonb_build_object(
    'pending', (select count(*) from public.tickets where status in ('new', 'triage')),
    'inProgress', (select count(*) from public.tickets where status = 'in_progress'),
    'awaitingConfirmation',
      (select count(*) from public.tickets where status = 'awaiting_confirmation'),
    'closed', (select count(*) from public.tickets where status = 'closed')
  );
end;
$$;

revoke all on function public.support_ticket_counts() from public, anon;
grant execute on function public.support_ticket_counts() to authenticated;

-- ---------------------------------------------------------------------------
-- support_ticket_detail — o painel lado a lado, com os factos técnicos
-- ---------------------------------------------------------------------------

create or replace function public.support_ticket_detail(p_ticket_id uuid)
returns table (
  id uuid,
  ref text,
  title text,
  description text,
  severity public.ticket_severity,
  status public.ticket_status,
  origin public.ticket_origin,
  route text,
  build_sha text,
  browser text,
  os text,
  viewport text,
  network text,
  session_id text,
  breadcrumbs jsonb,
  console_errors jsonb,
  screenshot_path text,
  technical_purged_at timestamptz,
  occurrences integer,
  affected_users integer,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  fix_note text,
  reporter_name text,
  reporter_role text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'not_staff' using hint = 'not_staff';
  end if;

  return query
  select
    t.id, t.ref, t.title, t.description, t.severity, t.status, t.origin,
    t.route, t.build_sha, t.browser, t.os, t.viewport, t.network, t.session_id,
    t.breadcrumbs, t.console_errors, t.screenshot_path, t.technical_purged_at,
    t.occurrences, t.affected_users, t.first_seen_at, t.last_seen_at, t.fix_note,
    coalesce(p.full_name, '—') as reporter_name,
    coalesce(p.role::text, '—') as reporter_role
  from public.tickets t
  left join public.profiles p on p.id = t.reporter_id
  where t.id = p_ticket_id;
end;
$$;

revoke all on function public.support_ticket_detail(uuid) from public, anon;
grant execute on function public.support_ticket_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ticket_history — "Últimas ações" do detalhe e a timeline de quem reportou
--
-- A mesma função para os dois, porque é a mesma informação: a sequência de
-- estados. O que muda é o vocabulário, e esse é da interface (07 §5.11).
-- A `note` de uma mudança é o "o que foi corrigido", que 04 §2.7 #5 diz
-- expressamente ser visível a quem reportou.
-- ---------------------------------------------------------------------------

create or replace function public.ticket_history(p_ticket_id uuid)
returns table (
  status_from public.ticket_status,
  status_to public.ticket_status,
  note text,
  actor_name text,
  occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_staff boolean := public.is_staff();
  v_is_reporter boolean;
begin
  select exists (
    select 1 from public.tickets t
    where t.id = p_ticket_id and t.reporter_id = auth.uid()
  ) into v_is_reporter;

  if not (v_is_staff or v_is_reporter) then
    raise exception 'not_allowed' using hint = 'not_allowed';
  end if;

  return query
  select
    e.status_from,
    e.status_to,
    e.note,
    -- Quem reportou **não** vê o nome de quem mexeu no ticket: saber que foi
    -- a "Ana" a fechar o seu bug não lhe serve de nada e é dado de um
    -- trabalhador. O staff vê, porque é o seu registo de trabalho.
    case when v_is_staff then coalesce(p.full_name, '—') else null end as actor_name,
    e.occurred_at
  from public.ticket_events e
  left join public.profiles p on p.id = e.actor_id
  where e.ticket_id = p_ticket_id
  order by e.occurred_at;
end;
$$;

revoke all on function public.ticket_history(uuid) from public, anon;
grant execute on function public.ticket_history(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- my_reports — "Os meus reports" (04 §2.3 e §2.4)
--
-- Zero colunas técnicas, pela razão no cabeçalho desta migração.
-- ---------------------------------------------------------------------------

create or replace function public.my_reports()
returns table (
  id uuid,
  ref text,
  title text,
  status public.ticket_status,
  severity public.ticket_severity,
  fix_note text,
  created_at timestamptz,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.ref, t.title, t.status, t.severity, t.fix_note,
         t.created_at, t.last_seen_at
  from public.tickets t
  where t.reporter_id = auth.uid()
  order by t.created_at desc
  limit 200;
$$;

revoke all on function public.my_reports() from public, anon;
grant execute on function public.my_reports() to authenticated;

-- ---------------------------------------------------------------------------
-- set_ticket_status — agora notifica quem reportou (04 §2.7 #5)
--
-- Substitui a versão de `20261007130000`, que mudava o estado e não avisava
-- ninguém. O resto do corpo é igual; o que entra é a chamada a `notify()`,
-- que já existe desde a Fase 5 e já tinha `ticket_update` na lista de tipos —
-- foi desenhada para isto.
--
-- A notificação **não** se envia a quem mexeu no próprio ticket: um membro do
-- Suporte que reporte um bug e depois o trate receberia o aviso da sua própria
-- ação.
-- ---------------------------------------------------------------------------

create or replace function public.set_ticket_status(
  p_ticket_id uuid,
  p_status public.ticket_status,
  p_fix_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_from public.ticket_status;
  v_reporter uuid;
  v_ref text;
  v_note text := nullif(trim(p_fix_note), '');
begin
  if not coalesce(
    (select role = 'support' from public.profiles where id = v_actor), false
  ) then
    raise exception 'not_support' using hint = 'not_support';
  end if;

  select status, reporter_id, ref
  into v_from, v_reporter, v_ref
  from public.tickets
  where id = p_ticket_id;

  if v_from is null then
    raise exception 'ticket_not_found' using hint = 'ticket_not_found';
  end if;

  if p_status = 'closed' and v_note is null then
    raise exception 'fix_note_required' using hint = 'fix_note_required';
  end if;

  update public.tickets
  set status = p_status,
      fix_note = coalesce(v_note, fix_note),
      updated_at = now()
  where id = p_ticket_id;

  insert into public.ticket_events (ticket_id, status_from, status_to, note, actor_id)
  values (p_ticket_id, v_from, p_status, v_note, v_actor);

  -- Mudança sem mudança nenhuma não notifica: guardar duas vezes o mesmo
  -- estado para acrescentar uma nota não é um passo novo para quem espera.
  if v_reporter is not null and v_reporter <> v_actor and v_from is distinct from p_status then
    perform public.notify(
      v_reporter,
      'ticket_update',
      case p_status
        when 'triage' then 'O seu relato está em análise'
        when 'in_progress' then 'Estamos a corrigir o seu relato'
        when 'awaiting_confirmation' then 'A correção do seu relato está em teste'
        when 'closed' then 'O seu relato está resolvido'
        else 'O seu relato foi atualizado'
      end,
      coalesce(v_note, 'Referência ' || v_ref || '.'),
      '/meus-reports?ticket=' || p_ticket_id::text,
      -- Agrupa por ticket: cinco mudanças de estado são cinco passos, não
      -- cinco notificações a competir no sino.
      'ticket:' || p_ticket_id::text
    );
  end if;
end;
$$;

revoke execute on function public.set_ticket_status(uuid, public.ticket_status, text)
  from public, anon;
grant execute on function public.set_ticket_status(uuid, public.ticket_status, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- admin_dashboard_metrics — acrescenta `open_bugs`. **Fecha D48.**
--
-- O corpo é o de `20261002130400`, com uma linha a mais no `summary`. 07 §21.2
-- mandou omitir o KPI até `tickets` existir, porque um zero seria
-- indistinguível de "nenhum bug aberto". A tabela existe desde hoje.
-- ---------------------------------------------------------------------------

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
      'new_leads',(select count(*) from public.site_leads where status='new'),
      'open_bugs',(select count(*) from public.tickets where status <> 'closed')
    ),
    'daily',(select coalesce(jsonb_agg(to_jsonb(d) order by d.date),'[]'::jsonb) from daily d),
    'activity',(select coalesce(items,'[]'::jsonb) from activity)
  ) into v_payload;
  return v_payload;
end;
$$;

revoke all on function public.admin_dashboard_metrics() from public,anon;
grant execute on function public.admin_dashboard_metrics() to authenticated;
comment on function public.admin_dashboard_metrics() is
  'Bounded Admin overview aggregates; excludes personal activity details. open_bugs entrou com P10-02 (D48).';
