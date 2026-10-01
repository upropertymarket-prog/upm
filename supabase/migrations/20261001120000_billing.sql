-- UProperty Market — migração da Fase 7 (Faturação), parte 1/2
--
-- Cobre P7-02 (Checkout e Portal) e dá a P7-04 onde pousar as faturas.
-- Referências: 05 §6.6 (planos e faturação), 02 §9 (Stripe), 07 §8.3 (preços,
-- PROVISÓRIOS), 07 §19.2/§19.3 (limites e extra), 08 §2 (RLS) e §3.5 (o que
-- o PostgREST não deve expor).
--
-- Três notas de leitura:
--
-- 1. `invoices` é um ESPELHO do Stripe (05 §6.6). A verdade está lá; esta
--    tabela existe para a app poder listar faturas sem uma chamada à API por
--    linha, e para "Guardar na Cloud" (P7-04) ser idempotente.
-- 2. Quem escreve nestas tabelas é o webhook, com `service_role`, que não
--    passa por RLS. As policies aqui são só de LEITURA — não existe caminho
--    de escrita a partir do cliente, e é de propósito: o estado da subscrição
--    é do Stripe, não do browser.
-- 3. `stripe_events` **não guarda o corpo do evento**. Um `invoice.paid`
--    traz e-mail, morada de faturação e o resto; guardá-lo era criar uma
--    segunda cópia de dados pessoais sem nenhuma necessidade (08 §6.3). Ficam
--    o id (que é o que dá a idempotência), o tipo e o resultado.

-- ---------------------------------------------------------------------------
-- invoices — 05 §6.6
-- ---------------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  stripe_invoice_id text not null unique,
  -- O número da fatura do Stripe (ex. `A1B2C3D4-0001`). Não é o número de uma
  -- fatura certificada portuguesa — essa é a questão 07 §9 #4, ainda em aberto.
  number text,
  total_cents bigint not null,
  currency text not null default 'eur',
  status text not null check (status in ('draft', 'open', 'paid', 'uncollectible', 'void')),
  hosted_url text,
  pdf_url text,
  issued_at timestamptz,
  -- P7-04: a cópia na Cloud do utilizador, quando ele a mandou guardar.
  -- Nulo é o normal — guardar é um gesto dele, nunca automático (07 §19.6).
  saved_file_id uuid references public.files (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 08 §4.1/§4.2: índice em toda FK e na coluna por que a lista ordena.
create index invoices_profile_idx on public.invoices (profile_id, issued_at desc);
create index invoices_subscription_idx on public.invoices (subscription_id);
create index invoices_saved_file_idx on public.invoices (saved_file_id)
  where saved_file_id is not null;

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- stripe_events — idempotência dos webhooks (02 §9)
--
-- A chave primária é o `event.id` do Stripe. É isso, e só isso, que impede um
-- reenvio (o Stripe repete um webhook que não responda 2xx) de aplicar o mesmo
-- efeito duas vezes.
-- ---------------------------------------------------------------------------

create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received'
    check (status in ('received', 'processed', 'ignored', 'failed')),
  error text
);

create index stripe_events_received_idx on public.stripe_events (received_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.invoices enable row level security;
alter table public.stripe_events enable row level security;

-- Cada um vê as suas faturas; o staff vê todas (Admin › Planos, 04 §8.5).
create policy invoices_select_own on public.invoices
  for select using (profile_id = auth.uid() or public.is_staff());

-- Sem policy de escrita: quem escreve é o webhook com `service_role`.
-- Uma tabela com RLS e sem policy de escrita não é um esquecimento — é a
-- forma de dizer que nenhuma sessão de utilizador pode inventar uma fatura.

-- `stripe_events` é só do servidor (08 §3.5): nem leitura. Sem policy nenhuma,
-- a RLS fecha-a a toda a gente menos à `service_role`, e o `revoke` abaixo
-- tira-a também da superfície do PostgREST.
revoke all on public.stripe_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- plan_status — o que o ecrã /plano precisa de saber antes de desenhar
--
-- Mesmo padrão de `cloud_status()` (Fase 6): uma função `security definer` que
-- devolve só o que o contexto já implica, em vez de alargar policies. E os
-- limites vêm SEMPRE de `effective_limits()`, nunca de `plans.limits` — senão
-- o extra de 07 §19.3 fica invisível para metade do código.
-- ---------------------------------------------------------------------------

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

  -- Sem subscrição ativa vale o plano do perfil (o passo "Plano" do registo,
  -- 07 §8.2 Fase 3) e, se nem isso, o Gratuito.
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
      'active_properties',
        (select count(*) from public.properties
          where owner_id = v_me and status in ('active', 'featured')),
      -- 07 §19.2 dá `visits` como "pedidos/mês". Quem FAZ um pedido é quem
      -- é contado: o proprietário só aceita, rejeita ou reagenda, e nada
      -- disso é um pedido novo. Janela = mês de calendário.
      'visits',
        (select count(*) from public.visit_requests
          where buyer_id = v_me
            and requested_at >= date_trunc('month', now())),
      'active_chats',
        (select count(*) from public.conversations where v_me in (buyer_id, owner_id)),
      'saved',
        (select count(*) from public.saved_properties where user_id = v_me),
      'alerts',
        (select count(*) from public.search_alerts where user_id = v_me)
    ),
    public.cloud_usage_bytes(v_me),
    public.cloud_limit_bytes(v_me);
end;
$$;

comment on function public.plan_status() is
  'Plano atual, subscrição, limites efetivos e uso por chave (P7-02). '
  'Os limites vêm de effective_limits (07 §19.3), nunca de plans.limits.';
