-- UProperty Market — migração da Fase 7 (Faturação), parte 2/2
--
-- P7-03: enforcement dos limites por plano, downgrade e o fecho de um buraco
-- de escalada de privilégios que estava aberto desde a Fase 0.
-- Referências: 07 §19.2 (grelha), 07 §19.3 (`effective_limits` é a única
-- fonte), 07 §19.4 (convite), 02 §9 (downgrade), 08 §5.3 (limites no
-- servidor), 08 §2.3 (matriz), 08 §4.3 (índices parciais).
--
-- Porquê GATILHOS e não verificações na Server Action: 08 §5.3 diz "limites de
-- plano aplicados no servidor, nunca só na UI". Uma verificação na action vale
-- enquanto for o único caminho até à tabela — e não é: há três apps, há RPC,
-- e amanhã há mais uma action. O gatilho é o único sítio onde a regra não se
-- consegue contornar.
--
-- Quem é contado, e porquê: **quem faz a ação**. Um pedido de visita é do
-- comprador (07 §19.2 diz "pedidos/mês"; o proprietário aceita, rejeita ou
-- reagenda, e nada disso é um pedido novo) e uma conversa é de quem a abre.
-- Travar o que CHEGA a alguém puniria o proprietário pelo plano dele e deixava
-- o comprador sem resposta nem explicação. Decisão do cliente, 1 out 2026.

-- ---------------------------------------------------------------------------
-- Escalada de privilégios no próprio perfil — fecha um buraco anterior
--
-- `profiles_update_own` (Fase 0) permite a cada um escrever na SUA linha, e a
-- RLS do Postgres não distingue colunas. Com isso, qualquer sessão autenticada
-- podia correr `update profiles set role = 'admin'` — ou, agora que o
-- enforcement existe, `set plan_id = <premium>` e dar a si mesma o plano de
-- topo sem pagar, porque `effective_limits()` recorre a `profiles.plan_id`
-- quando não há subscrição.
--
-- A ferramenta certa são PRIVILÉGIOS DE COLUNA, que a RLS não substitui: a
-- sessão deixa de poder escrever nas colunas que não são dela para mexer. Os
-- caminhos legítimos continuam abertos — a `service_role` do webhook não é
-- afetada, e o passo "Plano" do registo passa a ter função própria.
-- ---------------------------------------------------------------------------

revoke update on public.profiles from authenticated;

grant update (full_name, phone, avatar_path, locale, theme, preferences, notification_prefs)
  on public.profiles to authenticated;

/**
 * Passo "Plano" do registo (03 F2). Só deixa escolher um plano GRATUITO — um
 * plano pago entra por Checkout (P7-02) e é o webhook que o grava.
 */
create or replace function public.set_registration_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_plan record;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  select * into v_plan from public.plans where id = p_plan_id and visible;
  if not found then
    raise exception 'Plano inexistente' using errcode = '22023';
  end if;

  if v_plan.price_month_cents > 0 or v_plan.price_year_cents > 0 then
    raise exception 'Um plano pago entra por Checkout, não por aqui'
      using errcode = '42501';
  end if;

  update public.profiles set plan_id = p_plan_id where id = v_me;
end;
$$;

-- ---------------------------------------------------------------------------
-- Uma definição por contador — 08 §4.12 ("se um valor existe em dois sítios,
-- está escrito qual é a fonte")
--
-- `plan_status()` (P7-02), `cloud_status()` (Fase 6) e os gatilhos abaixo
-- passam todos por aqui. Antes havia duas contagens de `active_properties` a
-- nascer; agora há uma.
--
-- `active_properties` conta também `pending_review`: um imóvel à espera de
-- moderação já ocupa o lugar. Se não contasse, bastava submeter dez de
-- seguida para passar por cima do limite enquanto a fila não andasse.
-- ---------------------------------------------------------------------------

create or replace function public.plan_usage(p_profile_id uuid, p_key text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case p_key
    when 'active_properties' then (
      select count(*) from public.properties
      where owner_id = p_profile_id
        and status in ('active', 'featured', 'pending_review')
    )
    when 'visits' then (
      select count(*) from public.visit_requests
      where buyer_id = p_profile_id
        and requested_at >= date_trunc('month', now())
    )
    when 'active_chats' then (
      select count(*) from public.conversations
      where p_profile_id in (buyer_id, owner_id)
    )
    when 'saved' then (
      select count(*) from public.saved_properties where user_id = p_profile_id
    )
    when 'alerts' then (
      select count(*) from public.search_alerts where user_id = p_profile_id
    )
    else 0
  end;
$$;

comment on function public.plan_usage(uuid, text) is
  'Contador único por chave de limite (07 §19.2). plan_status, cloud_status e '
  'os gatilhos de enforcement leem daqui — nunca contam por conta própria.';

-- 08 §4.3: índices parciais onde há estado dominante.
create index properties_owner_slot_idx on public.properties (owner_id)
  where status in ('active', 'featured', 'pending_review');

create index visit_requests_buyer_month_idx
  on public.visit_requests (buyer_id, requested_at desc);

-- ---------------------------------------------------------------------------
-- O gatilho
-- ---------------------------------------------------------------------------

/**
 * `true` quando mais um item passa do limite efetivo. Limite nulo ou ausente
 * = ilimitado (07 §19.2) e nunca bloqueia.
 */
create or replace function public.plan_limit_exceeded(p_profile_id uuid, p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit jsonb := public.effective_limits(p_profile_id) -> p_key;
begin
  if v_limit is null or jsonb_typeof(v_limit) <> 'number' then
    return false;
  end if;
  return public.plan_usage(p_profile_id, p_key) + 1 > (v_limit #>> '{}')::numeric;
end;
$$;

/**
 * Gatilho genérico. `TG_ARGV[0]` é a chave do limite; `TG_ARGV[1]` o nome da
 * coluna da linha nova que diz de quem é a ação.
 *
 * A mensagem leva a chave no `hint` para a Server Action poder escolher o
 * convite certo de 07 §19.4 sem analisar texto.
 */
create or replace function public.enforce_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := tg_argv[0];
  v_profile uuid;
begin
  execute format('select ($1).%I', tg_argv[1]) into v_profile using new;

  if v_profile is not null and public.plan_limit_exceeded(v_profile, v_key) then
    raise exception 'Chegou ao limite do seu plano.'
      using errcode = 'P0001', hint = v_key;
  end if;

  return new;
end;
$$;

create trigger saved_properties_plan_limit
  before insert on public.saved_properties
  for each row execute function public.enforce_plan_limit('saved', 'user_id');

create trigger search_alerts_plan_limit
  before insert on public.search_alerts
  for each row execute function public.enforce_plan_limit('alerts', 'user_id');

-- Conta-se a quem ABRE a conversa. Quem a recebe não escolheu tê-la.
create trigger conversations_plan_limit
  before insert on public.conversations
  for each row execute function public.enforce_plan_limit('active_chats', 'buyer_id');

create trigger visit_requests_plan_limit
  before insert on public.visit_requests
  for each row execute function public.enforce_plan_limit('visits', 'buyer_id');

/**
 * Imóveis: o limite aplica-se quando o proprietário SUBMETE (`pending_review`,
 * ver `publishProperty`), não quando a moderação aprova — senão o limite dele
 * bloqueava o trabalho do admin, que é outra pessoa.
 *
 * O downgrade (02 §9) deixa excedentes `active`, e é suposto: não se apaga
 * nada. O que este gatilho impede é criar mais.
 */
create or replace function public.enforce_property_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending_review'
    and old.status is distinct from new.status
    and public.plan_limit_exceeded(new.owner_id, 'active_properties')
  then
    raise exception 'Chegou ao limite de imóveis do seu plano.'
      using errcode = 'P0001', hint = 'active_properties';
  end if;
  return new;
end;
$$;

create trigger properties_plan_limit
  before update on public.properties
  for each row execute function public.enforce_property_slot();

-- ---------------------------------------------------------------------------
-- Downgrade — 02 §9: efetivo no fim do período, excedentes em RASCUNHO,
-- nunca apagados.
--
-- Chamada pelo webhook quando a subscrição termina ou muda para um plano mais
-- pequeno. Os excedentes mais recentes são os que descem: quem já publicou há
-- mais tempo fica com o anúncio no ar.
-- ---------------------------------------------------------------------------

create or replace function public.apply_plan_downgrade(p_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit jsonb := public.effective_limits(p_profile_id) -> 'active_properties';
  v_allowed integer;
  v_moved integer := 0;
begin
  if v_limit is null or jsonb_typeof(v_limit) <> 'number' then
    return 0;
  end if;

  v_allowed := (v_limit #>> '{}')::integer;

  with excess as (
    select id
    from public.properties
    where owner_id = p_profile_id
      and status in ('active', 'featured', 'pending_review')
    order by published_at desc nulls first, created_at desc
    offset v_allowed
  )
  update public.properties p
    set status = 'draft'
  from excess
  where p.id = excess.id;

  get diagnostics v_moved = row_count;
  return v_moved;
end;
$$;

comment on function public.apply_plan_downgrade(uuid) is
  'Excedentes de imóveis passam a rascunho depois de um downgrade (02 §9). '
  'Nunca apaga nada; os mais antigos é que ficam publicados.';

-- ---------------------------------------------------------------------------
-- `cloud_status` passa a usar `plan_usage` — uma só definição de cada contador
-- ---------------------------------------------------------------------------

create or replace function public.cloud_status()
returns table (
  has_cloud boolean,
  used_bytes bigint,
  limit_bytes bigint,
  near_plan_limit boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_limits jsonb;
  v_limit_bytes bigint;
  v_near boolean := false;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  v_limits := public.effective_limits(v_me);
  v_limit_bytes := public.cloud_limit_bytes(v_me);

  v_near :=
    public.at_limit_ratio(public.plan_usage(v_me, 'active_properties'), v_limits -> 'active_properties')
    or public.at_limit_ratio(public.plan_usage(v_me, 'active_chats'), v_limits -> 'active_chats')
    or public.at_limit_ratio(public.plan_usage(v_me, 'saved'), v_limits -> 'saved')
    or public.at_limit_ratio(public.plan_usage(v_me, 'alerts'), v_limits -> 'alerts');

  return query select
    coalesce(v_limit_bytes is null or v_limit_bytes > 0, false),
    public.cloud_usage_bytes(v_me),
    v_limit_bytes,
    v_near;
end;
$$;

-- `plan_status` idem, para não ficarem duas contagens a divergir.
create or replace function public.plan_status()
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
  cloud_limit_bytes bigint
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

  if v_plan.id is null then
    select p.* into v_plan from public.plans p where p.slug = 'gratuito';
  end if;

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
    public.cloud_limit_bytes(v_me);
end;
$$;
