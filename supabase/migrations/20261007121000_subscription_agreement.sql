-- UProperty Market — Fase 9, 7/7
--
-- D58 — contrato de adesão (doc 13), primeira metade: **congelar o que foi
-- contratado** e escrever a linha do contrato.
--
-- O defeito que isto fecha: `subscriptions` congelava o compromisso e a versão
-- dos Termos, mas **não o preço, o nome do plano nem os limites** — lia-os de
-- `plans`, tabela que o Admin edita por `savePlan`. Um contrato gerado a partir
-- daí mostraria o preço de hoje a quem contratou ao preço de ontem. Um contrato
-- que se reescreve sozinho não prova nada, pela mesma razão por que
-- `terms_acceptances` guarda o hash do corpo e não só o número da versão.
--
-- Três decisões de desenho, e porquê:
--
-- 1. **Tabela própria, não colunas em `subscriptions`.** Uma subscrição muda ao
--    longo da vida — plano, periodicidade, extras. Cada mudança é um contrato
--    NOVO que remete para o anterior (doc 13 §3.3), e isso é uma linha por
--    celebração, não um conjunto de colunas que se sobrescrevem.
-- 2. **Append-only, como `terms_acceptances`.** Sem update e sem delete para a
--    sessão: um contrato que se pode editar depois de celebrado não serve de
--    prova. A escrita faz-se por função `security definer`, uma porta só.
-- 3. **A empresa também se congela.** `app_settings` tem os dados do prestador
--    e eles mudam (mudança de sede, de contacto). O contrato guarda o que
--    estava em vigor no dia — hoje são marcadores vazios, e é isso mesmo que
--    tem de ficar registado.
--
-- **A referência é provisória.** `UPM-<ano>-<6 dígitos>`, de uma sequência.
-- O formato é a decisão 3 de doc 13 §5, ainda por tomar; está isolado numa
-- função (`next_agreement_reference`) precisamente para mudar num sítio só.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- A sequência da referência. Reinicia-se por ano? NÃO: um número de contrato
-- que se repete entre anos obriga a ler o ano para o desambiguar, e a primeira
-- vez que alguém copiar só o número perde-se a referência. Corre sempre.
-- ---------------------------------------------------------------------------

create sequence if not exists public.subscription_agreement_seq as bigint start 1;

revoke all on sequence public.subscription_agreement_seq from anon, authenticated;

create or replace function public.next_agreement_reference()
returns text
language sql
volatile
set search_path = public
as $$
  select 'UPM-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.subscription_agreement_seq')::text, 6, '0');
$$;

comment on function public.next_agreement_reference() is
  'Referência do contrato de adesão. Formato provisório (doc 13 §5, decisão 3): isolado aqui para mudar num sítio só.';

-- ---------------------------------------------------------------------------
-- subscription_agreements — o contrato congelado
-- ---------------------------------------------------------------------------

create table public.subscription_agreements (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete restrict,
  profile_id uuid references public.profiles (id) on delete set null,
  reference text not null unique,
  celebrated_at timestamptz not null default now(),

  -- Congelado de `plans` no momento. `plan_id` fica por rastreabilidade, mas
  -- NUNCA é por ele que o contrato se lê.
  plan_id uuid references public.plans (id) on delete set null,
  plan_name text not null,
  plan_features text[] not null default '{}',
  plan_limits jsonb,

  -- Congelado de `addons` + `subscription_addons`: [{slug, name, priceCents}]
  addons jsonb not null default '[]'::jsonb,

  -- O preço efetivamente contratado, na periodicidade escolhida.
  price_cents bigint not null check (price_cents >= 0),
  -- E os DOIS preços do plano no dia da celebração. O contrato mostra o mensal
  -- como valor principal — é o que a pessoa paga — com o anual entre parêntesis,
  -- e para isso precisa de ambos congelados. Derivar um do outro seria inventar:
  -- o anual não é doze vezes o mensal (o registo chama-lhe "dois meses grátis").
  price_month_cents bigint not null check (price_month_cents >= 0),
  price_year_cents bigint not null check (price_year_cents >= 0),
  currency text not null default 'EUR' check (length(currency) = 3),
  interval text not null check (interval in ('month', 'year')),

  -- Copiado de `subscriptions`, que já os congelava (P9-03).
  minimum_commitment_months integer
    check (minimum_commitment_months is null or minimum_commitment_months >= 0),
  commitment_ends_at timestamptz,

  -- A adesão. O hash é o do corpo que a pessoa viu.
  terms_document_id uuid references public.legal_documents (id) on delete restrict,
  terms_version text,
  terms_content_hash text,
  terms_accepted_at timestamptz,
  terms_accepted_ip inet,

  -- Congelado de `app_settings`: {name, taxId, address, email, phone}
  provider jsonb not null default '{}'::jsonb,

  -- O contrato que este substitui, quando nasce de uma alteração de plano.
  supersedes_id uuid references public.subscription_agreements (id) on delete set null,

  created_at timestamptz not null default now()
);

create index subscription_agreements_profile_idx
  on public.subscription_agreements (profile_id, celebrated_at desc);
create index subscription_agreements_subscription_idx
  on public.subscription_agreements (subscription_id, celebrated_at desc);

comment on table public.subscription_agreements is
  'Contrato de adesão de cada subscritor (doc 13, D58). Append-only e congelado: '
  'nunca se deriva de `plans`, que o Admin edita. Uma linha por celebração.';

-- ---------------------------------------------------------------------------
-- RLS — cada um lê os seus, o staff lê todos, ninguém escreve pela sessão
-- ---------------------------------------------------------------------------

alter table public.subscription_agreements enable row level security;

create policy subscription_agreements_select_own on public.subscription_agreements
  for select using (profile_id = auth.uid() or public.is_staff());

revoke insert, update, delete on public.subscription_agreements from anon, authenticated;

-- ---------------------------------------------------------------------------
-- record_subscription_agreement — a única porta de escrita
--
-- Idempotente por desenho: se já existe um contrato para esta subscrição com o
-- MESMO conteúdo relevante (plano, preço, periodicidade, compromisso e versão
-- dos Termos), devolve-o em vez de criar outro. Sem isto, cada evento repetido
-- do Stripe — e eles repetem-se — criava um contrato novo.
-- ---------------------------------------------------------------------------

create or replace function public.record_subscription_agreement(p_subscription_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_plan record;
  v_price bigint;
  v_addons jsonb;
  v_provider jsonb;
  v_acceptance record;
  v_doc record;
  v_last record;
  v_id uuid;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if v_sub.id is null then
    return null;
  end if;

  -- Sem plano é uma subscrição só de extras (P9-05): não há contrato de adesão
  -- a um plano para escrever.
  if v_sub.plan_id is null then
    return null;
  end if;

  select * into v_plan from public.plans where id = v_sub.plan_id;
  if v_plan.id is null then
    return null;
  end if;

  v_price := case when v_sub.interval = 'month'
                  then v_plan.price_month_cents
                  else v_plan.price_year_cents end;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'slug', a.slug,
               'name', a.name,
               'priceCents', case when sa.interval = 'month'
                                  then a.price_month_cents
                                  else a.price_year_cents end
             )
             order by a.name
           ),
           '[]'::jsonb
         )
    into v_addons
  from public.subscription_addons sa
  join public.addons a on a.id = sa.addon_id
  where sa.subscription_id = p_subscription_id
    and sa.status in ('active', 'trialing');

  -- Os dados da empresa como estiverem HOJE. Hoje estão vazios, e é isso que
  -- fica registado — 07 §10 proíbe inventá-los.
  select coalesce(
           jsonb_object_agg(
             replace(key, 'company_', ''),
             value
           ) filter (where key like 'company_%'),
           '{}'::jsonb
         )
    into v_provider
  from public.app_settings;

  -- A aceitação que deu origem a esta subscrição: a mais recente do titular
  -- para o documento que a subscrição registou.
  select ta.* into v_acceptance
  from public.terms_acceptances ta
  where ta.profile_id = v_sub.profile_id
    and (v_sub.terms_document_id is null or ta.document_id = v_sub.terms_document_id)
  order by ta.accepted_at desc
  limit 1;

  select * into v_doc from public.legal_documents where id = v_sub.terms_document_id;

  -- Idempotência: nada mudou desde o último contrato desta subscrição?
  select * into v_last
  from public.subscription_agreements
  where subscription_id = p_subscription_id
  order by celebrated_at desc
  limit 1;

  if v_last.id is not null
     and v_last.plan_id is not distinct from v_sub.plan_id
     and v_last.price_cents = v_price
     and v_last.interval = v_sub.interval
     and v_last.minimum_commitment_months is not distinct from v_sub.minimum_commitment_months
     and v_last.terms_version is not distinct from v_sub.terms_version
     and v_last.addons = v_addons
  then
    return v_last.id;
  end if;

  insert into public.subscription_agreements (
    subscription_id, profile_id, reference, celebrated_at,
    plan_id, plan_name, plan_features, plan_limits, addons,
    price_cents, price_month_cents, price_year_cents, interval,
    minimum_commitment_months, commitment_ends_at,
    terms_document_id, terms_version, terms_content_hash,
    terms_accepted_at, terms_accepted_ip,
    provider, supersedes_id
  ) values (
    p_subscription_id, v_sub.profile_id, public.next_agreement_reference(),
    coalesce(v_sub.started_at, now()),
    v_plan.id, v_plan.name, v_plan.features, v_plan.limits, v_addons,
    v_price, v_plan.price_month_cents, v_plan.price_year_cents, v_sub.interval,
    v_sub.minimum_commitment_months, v_sub.commitment_ends_at,
    v_sub.terms_document_id, v_sub.terms_version, v_doc.content_hash,
    v_acceptance.accepted_at, v_acceptance.ip,
    v_provider, v_last.id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_subscription_agreement(uuid) from anon, authenticated;

comment on function public.record_subscription_agreement(uuid) is
  'Escreve o contrato de adesão congelado de uma subscrição (D58). Idempotente: '
  'repete-se sem criar duplicados quando nada mudou. Só service_role.';

-- ---------------------------------------------------------------------------
-- current_subscription_agreement — o que a página lê
-- ---------------------------------------------------------------------------

create or replace function public.subscription_agreements_for_me()
returns setof public.subscription_agreements
language sql
stable
security definer
set search_path = public
as $$
  select * from public.subscription_agreements
  where profile_id = auth.uid()
  order by celebrated_at desc, created_at desc;
$$;

grant execute on function public.subscription_agreements_for_me() to authenticated;

comment on function public.subscription_agreements_for_me() is
  'Os contratos de adesão do titular da sessão, do mais recente para o mais antigo.';
