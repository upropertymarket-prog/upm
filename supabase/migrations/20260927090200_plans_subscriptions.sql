-- UProperty Market — migração da Fase 2 (schema de domínio), parte 3/3
-- Cobre 05 §1.6 (planos e faturação — só as tabelas, sem Stripe: 07 §8.2).
-- Preços e limites são provisórios (07 §8.3/§9 #1 e #2) — ver supabase/seed.sql.

create type public.plan_audience as enum ('owner', 'buyer', 'both');

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  audience public.plan_audience not null,
  price_year_cents bigint not null,
  price_month_cents bigint not null,
  stripe_product_id text,
  stripe_price_year_id text,
  stripe_price_month_id text,
  -- 07 §9 #1: limites ainda não decididos pelo cliente. Fica null até lá;
  -- o enforcement (Fase 8) não pode ligar-se enquanto isto for null.
  limits jsonb,
  features text[] not null default '{}',
  visible boolean not null default true,
  "position" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plans_audience_idx on public.plans (audience);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- profiles.plan_id existe desde a Fase 0, sem FK (plans não existia ainda).
alter table public.profiles
  add constraint profiles_plan_id_fkey foreign key (plan_id) references public.plans (id);

create index profiles_plan_id_idx on public.profiles (plan_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  stripe_subscription_id text unique,
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  interval text not null default 'year' check (interval in ('month', 'year')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- 07 §8.1: trial de 7 dias, uma vez por perfil.
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_profile_idx on public.subscriptions (profile_id);
create index subscriptions_plan_idx on public.subscriptions (plan_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

-- plans: preços são públicos (página de preços, site sem sessão) — leitura
-- livre; escrita só admin (Admin › Planos, 04 §2.5). Sem Stripe ainda,
-- nenhuma escrita automática existe nesta fase.
-- rls-ok: catálogo de preços. A página de preços do site lê-o sem sessão, e
-- não há aqui nada que não esteja já publicado. A escrita é só de admin.
create policy plans_select_public on public.plans
  for select using (true);

create policy plans_admin_write on public.plans
  for all using (public.is_admin()) with check (public.is_admin());

-- subscriptions: cada um vê a sua; staff vê todas. Sem webhooks Stripe ainda
-- (Fase 8), a escrita fica reservada a admin (atribuição manual/trial).
create policy subscriptions_select_own on public.subscriptions
  for select using (profile_id = auth.uid() or public.is_staff());

create policy subscriptions_admin_write on public.subscriptions
  for all using (public.is_admin()) with check (public.is_admin());
