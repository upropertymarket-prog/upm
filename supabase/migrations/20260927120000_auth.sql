-- UProperty Market — Fase 3 (Autenticação e onboarding)
-- 07 §6 (staff_auth, reduzido — o TOTP passa a usar o MFA nativo do Supabase Auth,
-- ver 07 §6 patch no relatório da fase; só o PIN de operação e os códigos de
-- recuperação continuam a precisar de tabela própria) e 08 §5 (rate limiting,
-- fallback em Postgres — 07 §9.1).

-- ---------------------------------------------------------------------------
-- staff_auth — PIN de operação (Argon2id) + códigos de recuperação do 2FA.
-- Uma linha por membro de staff (admin|support). O segredo TOTP em si vive no
-- Supabase Auth (auth.mfa_factors), não aqui.
-- ---------------------------------------------------------------------------

create table public.staff_auth (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  -- Formato PHC ($argon2id$v=19$...), gerado por hash-wasm com outputType "encoded" —
  -- salt e parâmetros vêm embutidos, não há coluna de salt separada.
  pin_hash text,
  pin_updated_at timestamptz,
  recovery_codes_hash text[] not null default '{}',
  -- Válido 15 min (07 §6) — a ação sensível confere isto antes de prosseguir.
  last_step_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger staff_auth_set_updated_at
  before update on public.staff_auth
  for each row execute function public.set_updated_at();

alter table public.staff_auth enable row level security;

-- Cada membro de staff só lê/escreve a sua própria linha; admin lê/escreve todas
-- (suporte a operações administrativas, ex. forçar reset do PIN de outro staff).
create policy staff_auth_self on public.staff_auth
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- auth_attempts — rate limiting (08 §5, fallback em Postgres, 07 §9.1).
-- Append-only: só as funções abaixo escrevem (security definer, ignoram RLS).
-- ---------------------------------------------------------------------------

create table public.auth_attempts (
  id uuid primary key default gen_random_uuid(),
  -- E-mail normalizado (lower) ou endereço IP, consoante a chamada.
  identifier text not null,
  kind text not null check (
    kind in ('login', 'register', 'password_recovery', 'resend_verification', 'totp_challenge', 'pin_verify')
  ),
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);

create index auth_attempts_lookup_idx on public.auth_attempts (identifier, kind, created_at desc);

alter table public.auth_attempts enable row level security;

-- Mesma forma que audit_log: só admin lê a partir do cliente; a escrita é
-- exclusiva das funções security definer abaixo (08 §2.2 exige pelo menos uma
-- policy mesmo numa tabela sem escrita direta de nenhum papel).
create policy auth_attempts_admin_select on public.auth_attempts
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- check_auth_rate_limit — chamado ANTES de tentar a ação (login, recuperação,
-- registo, reenvio, desafio TOTP, verificação de PIN). Janela deslizante de
-- 15 min: a partir da 5.ª falha exige um intervalo crescente entre tentativas;
-- a partir de 10 falhas, bloqueio de 15 min (08 §5.5).
-- ---------------------------------------------------------------------------

create or replace function public.check_auth_rate_limit(p_identifier text, p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_window interval := interval '15 minutes';
  v_failed_count int;
  v_last_attempt timestamptz;
  v_seconds_since_last numeric;
  v_required_gap int;
begin
  select count(*) filter (where not succeeded), max(created_at)
    into v_failed_count, v_last_attempt
  from public.auth_attempts
  where identifier = lower(p_identifier)
    and kind = p_kind
    and created_at > now() - v_window;

  if v_failed_count >= 10 then
    return jsonb_build_object('allowed', false, 'retry_after_seconds', 900);
  end if;

  if v_failed_count >= 5 then
    v_required_gap := (v_failed_count - 4) * 15;
    v_seconds_since_last := extract(epoch from (now() - v_last_attempt));
    if v_seconds_since_last < v_required_gap then
      return jsonb_build_object(
        'allowed', false,
        'retry_after_seconds', ceil(v_required_gap - v_seconds_since_last)
      );
    end if;
  end if;

  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- record_auth_attempt — chamado DEPOIS de saber o resultado. Nunca falha o
-- fluxo do chamador (é só telemetria de rate limiting).
-- ---------------------------------------------------------------------------

create or replace function public.record_auth_attempt(p_identifier text, p_kind text, p_succeeded boolean)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.auth_attempts (identifier, kind, succeeded)
  values (lower(p_identifier), p_kind, p_succeeded);
$$;

grant execute on function public.check_auth_rate_limit(text, text) to anon, authenticated;
grant execute on function public.record_auth_attempt(text, text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Allowlist de IP/VPN do interno (07 §6) — reaproveita feature_flags, como o
-- launch_mode. Lista vazia = desativado (omissão).
-- ---------------------------------------------------------------------------

insert into public.feature_flags (key, value, description) values
  ('interno_ip_allowlist', '[]'::jsonb, 'CIDRs IPv4 permitidos em interno.*; [] = desativado (07 §6)');

-- ---------------------------------------------------------------------------
-- E-mail verificado → profiles.status = 'active' (07 §5.9). Só sai de
-- 'pending'; nunca reativa uma conta 'suspended' por este caminho.
-- ---------------------------------------------------------------------------

create or replace function public.handle_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set status = 'active'
  where id = new.id and status = 'pending';
  return new;
end;
$$;

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_email_confirmed();
