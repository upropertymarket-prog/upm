-- Utilizadores e Equipa separados no Admin (14 nov 2026)
-- =========================================================================
-- O diretório do Admin › Utilizadores misturava a equipa interna (admin,
-- suporte, marketing) com quem usa a app (compradores e proprietários). O
-- cliente: "isto não pode acontecer — têm de estar separados". Passam a ser
-- duas páginas, e a separação é feita aqui, na função, e não no ecrã: filtrar
-- depois de paginar deixava páginas com menos linhas e cursores errados.
--
-- `p_audience`: clients (buyer, owner) ou staff (admin, support,
-- marketing); null mantém o comportamento anterior. A função antiga sai antes:
-- duas versões com argumentos por omissão tornam a chamada por nome ambígua
-- no PostgREST.

drop function if exists public.admin_list_profiles(
  text, public.user_role, public.profile_status, uuid, timestamptz, uuid, text, integer
);

create or replace function public.admin_list_profiles(
  p_search text default null,
  p_role public.user_role default null,
  p_status public.profile_status default null,
  p_plan_id uuid default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_direction text default 'next',
  p_limit integer default 25,
  p_audience text default null
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
  if p_audience is not null and p_audience not in ('clients', 'staff') then
    raise exception 'Público inválido' using errcode = '22023';
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
        and (p_audience is null
          or (p_audience = 'clients' and p.role in ('buyer', 'owner'))
          or (p_audience = 'staff' and p.role in ('admin', 'support', 'marketing')))
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
        and (p_audience is null
          or (p_audience = 'clients' and p.role in ('buyer', 'owner'))
          or (p_audience = 'staff' and p.role in ('admin', 'support', 'marketing')))
      and (p_status is null or p.status = p_status)
      and (p_plan_id is null or coalesce(active_sub.plan_id, p.plan_id) = p_plan_id)
      and (v_search is null or p.full_name ilike '%' || v_search || '%' or u.email ilike '%' || v_search || '%')
      and (v_direction <> 'next' or p_cursor_id is null or (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id))
    order by p.created_at desc, p.id desc
    limit v_limit;
  end if;
end;
$$;

revoke all on function public.admin_list_profiles(
  text, public.user_role, public.profile_status, uuid, timestamptz, uuid, text, integer, text
) from public, anon;
grant execute on function public.admin_list_profiles(
  text, public.user_role, public.profile_status, uuid, timestamptz, uuid, text, integer, text
) to authenticated;
