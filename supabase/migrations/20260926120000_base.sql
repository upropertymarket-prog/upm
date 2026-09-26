-- UProperty Market — migração base (Fase 0, P0-02)
-- Cobre 05 §6.1 (identidade) e 05 §6.9 (transversal): profiles, staff_members,
-- feature_flags, audit_log. RLS ativa em todas, conforme 02 §7.
-- Helpers de papel definidos aqui e usados por todas as migrações seguintes.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('buyer', 'owner', 'admin', 'support');
create type public.profile_status as enum ('pending', 'active', 'suspended');
create type public.staff_department as enum ('suporte', 'financeiro', 'moderacao', 'admin');

-- ---------------------------------------------------------------------------
-- updated_at automático (usado por todas as tabelas do projeto)
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 com auth.users) — 05 §6.1
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'buyer',
  full_name text not null default '',
  phone text,
  avatar_path text,
  locale text not null default 'pt' check (locale in ('pt', 'en')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  plan_id uuid,
  stripe_customer_id text unique,
  status public.profile_status not null default 'pending',
  -- doc 07 §5.9: cortesia de 3 dias enquanto o e-mail não é verificado
  verification_grace_until timestamptz not null default (now() + interval '3 days'),
  preferences jsonb not null default '{}'::jsonb,
  notification_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_status_idx on public.profiles (status);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers de papel — 02 §7.1. security definer para poderem ler profiles
-- dentro das próprias policies sem recursão de RLS.
-- ---------------------------------------------------------------------------

create or replace function public.role_of(uid uuid)
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = uid;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'support') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- staff_members — 05 §6.1. Fonte das variáveis de assinatura de e-mail.
-- ---------------------------------------------------------------------------

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  department public.staff_department not null,
  title text not null default '',
  phone text,
  is_coordinator boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger staff_members_set_updated_at
  before update on public.staff_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- feature_flags — 05 §6.9. launch_mode vive aqui (03 F14).
-- ---------------------------------------------------------------------------

create table public.feature_flags (
  key text primary key,
  value jsonb not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

insert into public.feature_flags (key, value, description) values
  ('launch_mode', '"pre"'::jsonb, 'pre | post — controla o site público (03 §1.1 e F14)');

-- ---------------------------------------------------------------------------
-- audit_log — 05 §6.9. Escrito apenas pelo servidor (service_role).
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  diff jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

-- ---------------------------------------------------------------------------
-- Criação automática do profile ao registar
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'buyer')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS — 02 §7.1. Ativa em todas as tabelas; nada é legível por omissão.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.staff_members enable row level security;
alter table public.feature_flags enable row level security;
alter table public.audit_log enable row level security;

-- profiles: cada um lê e edita o seu; staff lê todos; só admin altera os outros.
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_staff());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- staff_members: staff lê; só admin escreve.
create policy staff_members_select on public.staff_members
  for select using (public.is_staff());

create policy staff_members_admin_write on public.staff_members
  for all using (public.is_admin()) with check (public.is_admin());

-- feature_flags: leitura pública (o site precisa de launch_mode); escrita só admin.
create policy feature_flags_select on public.feature_flags
  for select using (true);

create policy feature_flags_admin_write on public.feature_flags
  for all using (public.is_admin()) with check (public.is_admin());

-- audit_log: só admin lê. Escrita exclusivamente por service_role,
-- que ignora RLS — por isso não há policy de insert.
create policy audit_log_admin_select on public.audit_log
  for select using (public.is_admin());
