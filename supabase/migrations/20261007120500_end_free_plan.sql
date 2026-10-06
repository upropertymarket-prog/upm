-- UProperty Market — Fase 9, 6/6
--
-- P9-05 — fim da conta Gratuita e onboarding pago.
--
-- **Decisão do cliente, 7 out 2026:** não há plano gratuito e **não há trial
-- gratuito, de todo**. Quem se quer inscrever paga no momento da inscrição,
-- depois de preencher os seus dados, ver o contrato e concordar com ele.
--
-- O que isso obriga a mudar, e porquê cada peça:
--
-- 1. O degrau `gratuito` sai da escada. A LINHA fica — `subscriptions.plan_id`
--    e `profiles.plan_id` de contas antigas apontam para ela, e apagá-la era
--    reescrever história. Fica invisível, e um `check` novo impede que
--    qualquer plano a 0 € volte a aparecer na escada.
-- 2. `effective_limits()` deixa de cair no Gratuito. Sem subscrição ativa, os
--    limites são **zero em todas as chaves** — é o que faz "só contratação e
--    definições" ser verdade também do lado do Postgres, e não só do guard de
--    navegação. Os gatilhos de 07 §20.5 passam a recusar publicar, guardar,
--    criar alertas e abrir conversas sem subscrição, sem código novo.
-- 3. `plan_status()` deixa de inventar um plano. Sem subscrição, devolve plano
--    nulo — e o ecrã mostra a contratação, não um plano a 0 €.
-- 4. `trial_eligible()` passa a devolver sempre `false`. A função e
--    `trial_extension_requests` ficam: são história de P7-06 e o seu registo
--    não se apaga. O que deixa de existir é o direito.
-- 5. `set_registration_plan()` desaparece. Existia para gravar um plano
--    gratuito escolhido no registo, e não há nenhum.
-- 6. `subscriptions.plan_id` passa a aceitar `null`, para o caso que já existia
--    e caía no Gratuito por falta de sítio: uma subscrição só de extras.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. O degrau sai da escada
-- ---------------------------------------------------------------------------

update public.plans set visible = false where slug = 'gratuito';

-- Contas que estavam no Gratuito deixam de ter plano. Não ficam com um plano
-- pago que não compraram, e não ficam num plano que já não existe na escada.
update public.profiles
   set plan_id = null
 where plan_id in (select id from public.plans where slug = 'gratuito');

alter table public.plans
  add constraint plans_no_free_visible
  check (visible = false or price_month_cents > 0 or price_year_cents > 0);

comment on constraint plans_no_free_visible on public.plans is
  'Nenhum plano a 0 € volta à escada (P9-05, decisão do cliente de 7 out 2026).';

alter table public.subscriptions
  alter column plan_id drop not null;

comment on column public.subscriptions.plan_id is
  'null = subscrição apenas de extras (07 §19.3). Antes de P9-05 caía no plano Gratuito.';

-- ---------------------------------------------------------------------------
-- 2. effective_limits sem Gratuito
-- ---------------------------------------------------------------------------

/**
 * Os limites de quem não tem subscrição ativa. Zero em todas as chaves — não
 * é um plano, é a ausência dele. Escrito numa função para existir UM sítio com
 * esta resposta (08 §4.12).
 */
create or replace function public.no_plan_limits()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'active_properties', 0,
    'visits', 0,
    'active_chats', 0,
    'saved', 0,
    'alerts', 0,
    'cloud_gb', 0
  );
$$;

comment on function public.no_plan_limits() is
  'Limites sem subscrição ativa: zero em tudo (P9-05). Nunca se lê plans para isto.';

create or replace function public.effective_limits(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limits jsonb;
  v_subscription_id uuid;
  v_has_subscription boolean := false;
  v_key text;
  v_bonus numeric;
begin
  -- `left join`: uma subscrição só de extras tem `plan_id` null desde P9-05 e
  -- continua a dar direito aos extras que paga. Com `join` desaparecia daqui.
  select s.id, p.limits
    into v_subscription_id, v_limits
  from public.subscriptions s
  left join public.plans p on p.id = s.plan_id
  where s.profile_id = p_profile_id
    and s.status in ('active', 'trialing')
  order by s.created_at desc
  limit 1;

  -- `found`, e não um terceiro valor no `into`: um `select into` sem linhas põe
  -- as variáveis a NULL, e `if not null` nunca entra. Já custou tempo noutro
  -- sítio deste repositório.
  v_has_subscription := found;

  -- Sem subscrição ativa vale o plano atribuído ao perfil, se houver (é o
  -- caminho de uma atribuição manual de admin). Já não existe degrau gratuito
  -- por baixo disso.
  if not v_has_subscription then
    select p.limits into v_limits
    from public.profiles pr
    join public.plans p on p.id = pr.plan_id
    where pr.id = p_profile_id;
  end if;

  if v_limits is null then
    v_limits := public.no_plan_limits();
  end if;

  if v_subscription_id is null then
    return v_limits;
  end if;

  for v_key, v_bonus in
    select g.key, sum((g.value)::numeric)
    from public.subscription_addons sa
    join public.addons a on a.id = sa.addon_id
    cross join lateral jsonb_each_text(a.grants) as g(key, value)
    where sa.subscription_id = v_subscription_id
      and sa.status in ('active', 'trialing')
    group by g.key
  loop
    if v_limits ? v_key and jsonb_typeof(v_limits -> v_key) = 'number' then
      v_limits := jsonb_set(
        v_limits,
        array[v_key],
        to_jsonb(((v_limits ->> v_key)::numeric) + v_bonus)
      );
    end if;
  end loop;

  return v_limits;
end;
$$;

comment on function public.effective_limits(uuid) is
  'Limites efetivos: plano da subscrição ativa + extras (07 §19.2/§19.3). '
  'Sem subscrição → no_plan_limits() (P9-05). null numa chave = ilimitado.';

-- ---------------------------------------------------------------------------
-- 3. plan_status sem plano inventado
--
-- `drop` antes do `create`, e não `create or replace`: a função ganha quatro
-- colunas de saída (o compromisso, o início e a versão dos Termos), e o Postgres
-- recusa mudar o tipo de retorno de uma função existente — "cannot change
-- return type of existing function". Nada em SQL a referencia, por isso o drop
-- é seguro; quem a chama é a aplicação, pelo PostgREST.
-- ---------------------------------------------------------------------------

drop function if exists public.plan_status();

create function public.plan_status()
returns table (
  plan_id uuid,
  plan_slug text,
  plan_name text,
  plan_audience public.plan_audience,
  subscription_id uuid,
  subscription_status text,
  billing_interval text,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  trial_ends_at timestamptz,
  has_cloud_addon boolean,
  limits jsonb,
  usage jsonb,
  cloud_used_bytes bigint,
  cloud_limit_bytes bigint,
  -- Novas em P9-03/P9-09: o ecrã de contratação precisa de as mostrar, e o de
  -- cancelamento precisa delas para não recalcular nada.
  minimum_commitment_months integer,
  commitment_ends_at timestamptz,
  started_at timestamptz,
  terms_version text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_sub record;
  v_plan record;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  select s.* into v_sub
  from public.subscriptions s
  where s.profile_id = v_me
    and s.status in ('active', 'trialing')
  order by s.created_at desc
  limit 1;

  select p.* into v_plan
  from public.plans p
  where p.id = coalesce(
    v_sub.plan_id,
    (select pr.plan_id from public.profiles pr where pr.id = v_me)
  );

  -- P9-05: sem plano NÃO se cai no Gratuito. Fica tudo nulo, e o ecrã mostra
  -- a contratação. Um plano a 0 € no lugar disto era mentira em dois sítios:
  -- no nome e nos limites.

  return query
  select
    v_plan.id,
    v_plan.slug,
    v_plan.name,
    v_plan.audience,
    v_sub.id,
    v_sub.status,
    v_sub.interval,
    v_sub.current_period_end,
    coalesce(v_sub.cancel_at_period_end, false),
    v_sub.trial_ends_at,
    exists (
      select 1
      from public.subscription_addons sa
      join public.addons a on a.id = sa.addon_id
      where sa.subscription_id = v_sub.id
        and sa.status in ('active', 'trialing')
        and a.grants ? 'cloud_gb'
    ),
    public.effective_limits(v_me),
    jsonb_build_object(
      'active_properties', public.plan_usage(v_me, 'active_properties'),
      'visits', public.plan_usage(v_me, 'visits'),
      'active_chats', public.plan_usage(v_me, 'active_chats'),
      'saved', public.plan_usage(v_me, 'saved'),
      'alerts', public.plan_usage(v_me, 'alerts')
    ),
    public.cloud_usage_bytes(v_me),
    public.cloud_limit_bytes(v_me),
    v_sub.minimum_commitment_months,
    v_sub.commitment_ends_at,
    v_sub.started_at,
    v_sub.terms_version;
end;
$$;

comment on function public.plan_status() is
  'Plano atual, subscrição, compromisso, limites e uso (P7-02, P9-03). '
  'Sem subscrição devolve plano nulo: não existe degrau gratuito (P9-05).';

-- ---------------------------------------------------------------------------
-- 4. O trial deixa de existir como direito
-- ---------------------------------------------------------------------------

create or replace function public.trial_eligible(p_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- P9-05, decisão do cliente de 7 out 2026: não há trial gratuito, de todo.
  -- A função fica (é chamada por P7-02 e por `trial_status`) e passa a dizer
  -- sempre que não. `trial_extension_requests` e os pedidos que lá estiverem
  -- não se apagam: são história da Fase 7.
  select false;
$$;

comment on function public.trial_eligible(uuid) is
  'Sempre false desde P9-05: o trial gratuito foi retirado por decisão do cliente (7 out 2026).';

-- ---------------------------------------------------------------------------
-- 5. set_registration_plan desaparece
-- ---------------------------------------------------------------------------

drop function if exists public.set_registration_plan(uuid);

-- ---------------------------------------------------------------------------
-- 6. subscription_entitled — uma só resposta a "esta conta tem acesso?"
--
-- O guard de navegação, as páginas e os RPC têm de concordar. Uma segunda
-- definição em TypeScript voltaria a divergir no primeiro estado novo.
-- ---------------------------------------------------------------------------

create or replace function public.subscription_entitled(p_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select true
      from public.subscriptions s
      where s.profile_id = p_profile_id
        and s.status in ('active', 'trialing')
        and s.plan_id is not null
      limit 1
    ),
    -- Atribuição manual de admin (profiles.plan_id) também dá acesso, desde
    -- que o plano exista e não seja um degrau a 0 €.
    (
      select true
      from public.profiles pr
      join public.plans p on p.id = pr.plan_id
      where pr.id = p_profile_id
        and (p.price_month_cents > 0 or p.price_year_cents > 0)
      limit 1
    ),
    false
  );
$$;

grant execute on function public.subscription_entitled(uuid) to authenticated;

comment on function public.subscription_entitled(uuid) is
  'Tem acesso à app? Subscrição ativa com plano, ou plano pago atribuído por admin (P9-05).';
