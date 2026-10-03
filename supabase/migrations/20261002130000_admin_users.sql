-- UProperty Market — Fase 8 (Admin), P8-02
-- Utilizadores: listagem protegida, detalhe mínimo, suspensão auditada e
-- registo separado das leituras de dados pessoais (04 §8.5, 07 §13.3, 08).

create table public.personal_data_access_log (
  id bigint generated always as identity primary key,
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  subject_type text not null check (subject_type in ('profile')),
  subject_id uuid not null,
  action text not null check (action in ('view')),
  occurred_at timestamptz not null default now()
);

create index personal_data_access_log_subject_idx
  on public.personal_data_access_log (actor_profile_id, subject_type, subject_id, occurred_at desc);
create index personal_data_access_log_retention_idx
  on public.personal_data_access_log (occurred_at);

alter table public.personal_data_access_log enable row level security;
create policy personal_data_access_log_admin_select
  on public.personal_data_access_log for select using (public.is_admin());

revoke all on public.personal_data_access_log from anon, authenticated;
grant select on public.personal_data_access_log to authenticated;
revoke all on sequence public.personal_data_access_log_id_seq from anon, authenticated;

comment on table public.personal_data_access_log is
  'Consultas a dados pessoais; separado do audit_log de mutações (07 §13.3). Append-only, retenção de 2 anos.';

-- O evento parte do browser depois de o drawer estar visível. A função identifica
-- o actor pela sessão e serializa por actor/subject para deduplicar acessos feitos
-- em separadores diferentes.
create or replace function public.record_personal_data_access(
  p_subject_type text,
  p_subject_id uuid,
  p_action text default 'view'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if not public.is_admin() or v_actor is null then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_subject_type <> 'profile' or p_action <> 'view' or p_subject_id is null then
    raise exception 'Consulta inválida' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || ':profile:' || p_subject_id::text, 0)
  );

  if exists (
    select 1
    from public.personal_data_access_log l
    where l.actor_profile_id = v_actor
      and l.subject_type = p_subject_type
      and l.subject_id = p_subject_id
      and l.action = p_action
      and l.occurred_at > now() - interval '15 minutes'
  ) then
    return false;
  end if;

  insert into public.personal_data_access_log (actor_profile_id, subject_type, subject_id, action)
  values (v_actor, p_subject_type, p_subject_id, p_action);
  return true;
end;
$$;

revoke all on function public.record_personal_data_access(text, uuid, text) from public, anon;
grant execute on function public.record_personal_data_access(text, uuid, text) to authenticated;

-- A página recebe só os campos da linha de tabela. Auth email e plano são
-- resolvidos aqui, sem enviar auth.users nem a linha completa de profiles ao RSC.
create or replace function public.admin_list_profiles(
  p_search text default null,
  p_role public.user_role default null,
  p_status public.profile_status default null,
  p_plan_id uuid default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_direction text default 'next',
  p_limit integer default 25
)
returns table (
  id uuid,
  full_name text,
  email text,
  role public.user_role,
  status public.profile_status,
  plan_name text,
  plan_slug text,
  subscription_status text,
  trial_ends_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(p_search), '');
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_direction text := coalesce(p_direction, 'next');
begin
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v_direction not in ('next', 'prev') then
    raise exception 'Direção inválida' using errcode = '22023';
  end if;
  if (p_cursor_created_at is null) <> (p_cursor_id is null) then
    raise exception 'Cursor inválido' using errcode = '22023';
  end if;

  if v_direction = 'prev' and p_cursor_id is not null then
    return query
    with profile_page as (
      select
        p.id,
        p.full_name,
        u.email::text as email,
        p.role,
        p.status,
        coalesce(active_plan.name, profile_plan.name)::text as plan_name,
        coalesce(active_plan.slug, profile_plan.slug)::text as plan_slug,
        active_sub.status::text as subscription_status,
        active_sub.trial_ends_at,
        p.created_at
      from public.profiles p
      join auth.users u on u.id = p.id
      left join lateral (
        select s.plan_id, s.status, s.trial_ends_at
        from public.subscriptions s
        where s.profile_id = p.id and s.status in ('active', 'trialing', 'past_due')
        order by s.created_at desc, s.id desc
        limit 1
      ) active_sub on true
      left join public.plans active_plan on active_plan.id = active_sub.plan_id
      left join public.plans profile_plan on profile_plan.id = p.plan_id
      where (p_role is null or p.role = p_role)
        and (p_status is null or p.status = p_status)
        and (p_plan_id is null or coalesce(active_sub.plan_id, p.plan_id) = p_plan_id)
        and (v_search is null or p.full_name ilike '%' || v_search || '%' or u.email ilike '%' || v_search || '%')
        and (p.created_at, p.id) > (p_cursor_created_at, p_cursor_id)
      order by p.created_at asc, p.id asc
      limit v_limit
    )
    select profile_page.id, profile_page.full_name, profile_page.email, profile_page.role, profile_page.status,
      profile_page.plan_name, profile_page.plan_slug, profile_page.subscription_status,
      profile_page.trial_ends_at, profile_page.created_at
    from profile_page
    order by profile_page.created_at desc, profile_page.id desc;
  else
    return query
    select
      p.id,
      p.full_name,
      u.email::text,
      p.role,
      p.status,
      coalesce(active_plan.name, profile_plan.name)::text,
      coalesce(active_plan.slug, profile_plan.slug)::text,
      active_sub.status::text,
      active_sub.trial_ends_at,
      p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join lateral (
      select s.plan_id, s.status, s.trial_ends_at
      from public.subscriptions s
      where s.profile_id = p.id and s.status in ('active', 'trialing', 'past_due')
      order by s.created_at desc, s.id desc
      limit 1
    ) active_sub on true
    left join public.plans active_plan on active_plan.id = active_sub.plan_id
    left join public.plans profile_plan on profile_plan.id = p.plan_id
    where (p_role is null or p.role = p_role)
      and (p_status is null or p.status = p_status)
      and (p_plan_id is null or coalesce(active_sub.plan_id, p.plan_id) = p_plan_id)
      and (v_search is null or p.full_name ilike '%' || v_search || '%' or u.email ilike '%' || v_search || '%')
      and (v_direction <> 'next' or p_cursor_id is null or (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id))
    order by p.created_at desc, p.id desc
    limit v_limit;
  end if;
end;
$$;

create or replace function public.admin_profile_detail(p_profile_id uuid)
returns table (
  id uuid,
  full_name text,
  email text,
  role public.user_role,
  status public.profile_status,
  created_at timestamptz,
  updated_at timestamptz,
  plan_name text,
  plan_slug text,
  subscription_status text,
  current_period_end timestamptz,
  trial_ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.full_name,
    u.email::text,
    p.role,
    p.status,
    p.created_at,
    p.updated_at,
    coalesce(active_plan.name, profile_plan.name)::text,
    coalesce(active_plan.slug, profile_plan.slug)::text,
    active_sub.status::text,
    active_sub.current_period_end,
    active_sub.trial_ends_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select s.plan_id, s.status, s.current_period_end, s.trial_ends_at
    from public.subscriptions s
    where s.profile_id = p.id and s.status in ('active', 'trialing', 'past_due')
    order by s.created_at desc, s.id desc
    limit 1
  ) active_sub on true
  left join public.plans active_plan on active_plan.id = active_sub.plan_id
  left join public.plans profile_plan on profile_plan.id = p.plan_id
  where p.id = p_profile_id;
end;
$$;

create or replace function public.admin_set_profile_status(
  p_profile_id uuid,
  p_status public.profile_status,
  p_reason text
)
returns public.profile_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.profile_status;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  perform public.require_step_up();
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_profile_id is null or p_status not in ('active', 'suspended') then
    raise exception 'Estado inválido' using errcode = '22023';
  end if;
  if length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'Indique um motivo entre 3 e 500 caracteres' using errcode = '22023';
  end if;
  if p_profile_id = auth.uid() and p_status = 'suspended' then
    raise exception 'Não pode suspender a própria conta' using errcode = '42501';
  end if;

  select p.status into v_before
  from public.profiles p
  where p.id = p_profile_id
  for update;
  if not found then
    raise exception 'Conta não encontrada' using errcode = 'P0002';
  end if;
  if v_before not in ('active', 'suspended') then
    raise exception 'Só é possível suspender ou reativar contas ativas' using errcode = '22023';
  end if;
  if v_before = p_status then
    return v_before;
  end if;

  update public.profiles set status = p_status where id = p_profile_id;
  perform public.write_audit_log(
    case when p_status = 'suspended' then 'profile.suspended' else 'profile.reactivated' end,
    'profiles',
    p_profile_id,
    jsonb_build_object('before', jsonb_build_object('status', v_before),
      'after', jsonb_build_object('status', p_status), 'reason', v_reason)
  );
  return p_status;
end;
$$;

revoke all on function public.admin_list_profiles(text, public.user_role, public.profile_status, uuid, timestamptz, uuid, text, integer) from public, anon;
revoke all on function public.admin_profile_detail(uuid) from public, anon;
revoke all on function public.admin_set_profile_status(uuid, public.profile_status, text) from public, anon;
grant execute on function public.admin_list_profiles(text, public.user_role, public.profile_status, uuid, timestamptz, uuid, text, integer) to authenticated;
grant execute on function public.admin_profile_detail(uuid) to authenticated;
grant execute on function public.admin_set_profile_status(uuid, public.profile_status, text) to authenticated;

comment on function public.admin_list_profiles(text, public.user_role, public.profile_status, uuid, timestamptz, uuid, text, integer) is
  'Admin-only user directory. Bounded keyset pages; auth email is resolved inside the definer.';
comment on function public.admin_profile_detail(uuid) is
  'Admin-only minimum profile detail; deliberately excludes phone, address, conversations, and documents.';
comment on function public.admin_set_profile_status(uuid, public.profile_status, text) is
  'Suspend/reactivate an account with PIN step-up and an audit before/after record.';

-- 07 §13.6: access records live for two years. Keep the delete in pg_cron,
-- not in an application request.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-personal-data-access-log',
      '25 3 * * *',
      $job$delete from public.personal_data_access_log where occurred_at < now() - interval '2 years'$job$
    );
  end if;
end;
$$;
