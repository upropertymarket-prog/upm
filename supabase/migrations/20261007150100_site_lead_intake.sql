-- ---------------------------------------------------------------------------
-- Entrada pública de leads — pré-inscrição e contacto (P2-02 · paga D49)
--
-- NUMERADA 150100 e não 150000: outra sessão a correr em paralelo neste repo
-- escreveu 20261007150000_legal_sem_aviso_minuta.sql três minutos antes, e as
-- duas colidiram no mesmo número. O `db push` aplicou a primeira e recusou
-- esta no insert do histórico. Fica registado porque o sintoma — "duplicate
-- key ... schema_migrations_pkey" — não diz em lado nenhum que há dois
-- ficheiros com o mesmo prefixo.
-- ===========================================================================
-- `site_leads` existe desde a Fase 8 com o comentário "Public ingestion is
-- delivered in P2-02" e **nunca recebeu uma linha**: não havia formulário.
-- É o sintoma visível de D59 e é D49 por inteiro.
--
-- O problema desta tabela não é o de todas as outras. Aqui a escrita vem de
-- `anon` — de qualquer pessoa na internet, sem sessão, sem conta e sem nada
-- que a identifique. Por isso **não há policy de insert**: a entrada é uma
-- função `security definer` que impõe, por esta ordem, tudo o que um
-- formulário público precisa (04 §2.1, 08 §5):
--
--   1. **Rate limit por IP**, na tabela `auth_attempts` da Fase 3 — é o que
--      D18 chama "estender o mecanismo às superfícies novas". A tabela é a
--      mesma; a função é nova, e a secção seguinte explica porquê.
--   2. **Honeypot**: um campo que ninguém vê e que um bot preenche. Quando
--      vem preenchido, a função devolve **sucesso** e não grava nada. Dizer
--      "recusado" ensinaria o bot a contornar; o silêncio não.
--   3. **Double opt-in**: a linha nasce `status = 'new'` mas com
--      `confirmed_at` nulo, e só conta como lead depois de o e-mail ser
--      confirmado. Sem isto, qualquer pessoa inscreve o endereço de outra.
--   4. **Deduplicação** por e-mail e formulário: reenviar o pedido devolve o
--      mesmo registo e um token novo, em vez de encher o CRM.
--
-- O CAPTCHA fica de fora e com número próprio (ver o fim do ficheiro).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- O rate limit reutiliza a tabela da Fase 3, mas não a sua função
--
-- `auth_attempts` é a tabela certa — é o que D18 quer dizer com "estender o
-- mecanismo às superfícies novas", e um segundo contador seria um segundo
-- sítio onde procurar abuso. Mas `check_auth_rate_limit` **não** serve aqui, e
-- vale a pena dizer porquê em vez de a chamar e ficar com a falsa sensação de
-- proteção: ela conta só as tentativas **falhadas**, porque foi desenhada para
-- logins — dez palavras-passe erradas são um ataque, dez logins certos não.
--
-- Numa submissão pública é o contrário: **toda** a submissão conta. Um bot que
-- envie quinhentos formulários válidos tem quinhentos sucessos e zero falhas,
-- e passaria incólume pela função de autenticação.
-- ---------------------------------------------------------------------------

-- A lista completa é a de `20260930120100_cloud_functions.sql`, que já tinha
-- estendido o `check` da Fase 3 com `share_code`. **Reconstruir esta lista a
-- partir da migração original perderia esse valor** — e a primeira tentativa
-- desta migração fez exactamente isso: falhou com
-- `check constraint ... is violated by some row`, porque há 4 linhas
-- `share_code` em staging. Ficou o aviso: um `drop constraint` + `add` copia
-- a definição **atual**, não a que a memória sugere.
alter table public.auth_attempts drop constraint auth_attempts_kind_check;
alter table public.auth_attempts add constraint auth_attempts_kind_check check (
  kind in (
    'login', 'register', 'password_recovery', 'resend_verification',
    'totp_challenge', 'pin_verify', 'share_code',
    -- P2-02: submissão de formulário público.
    'site_lead'
  )
);

/**
 * Limite por volume, não por falha. Conta todas as linhas da janela.
 */
create or replace function public.check_submission_rate_limit(
  p_identifier text,
  p_kind text,
  p_max integer default 5,
  p_window interval default interval '15 minutes'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) < greatest(coalesce(p_max, 5), 1)
  from public.auth_attempts
  where identifier = lower(coalesce(p_identifier, ''))
    and kind = p_kind
    and created_at > now() - coalesce(p_window, interval '15 minutes');
$$;

revoke all on function public.check_submission_rate_limit(text, text, integer, interval)
  from public, anon, authenticated;

-- Duas colunas novas, ambas para o double opt-in. `confirmed_at` é a prova de
-- consentimento que o RGPD pede para marketing — e é também o que distingue
-- um lead real de um endereço que alguém escreveu.
alter table public.site_leads
  add column confirmed_at timestamptz,
  add column confirm_token_hash text;

-- O token **nunca** é guardado em claro: o que fica é o seu SHA-256. Quem
-- leia a tabela — e o Admin lê-a inteira — não consegue confirmar a
-- inscrição de outra pessoa a partir dela.
create unique index site_leads_confirm_token_idx
  on public.site_leads (confirm_token_hash)
  where confirm_token_hash is not null;

create index site_leads_unconfirmed_idx
  on public.site_leads (created_at)
  where confirmed_at is null;

comment on column public.site_leads.confirmed_at is
  'Double opt-in: quando o titular confirmou o e-mail. Nulo = ainda não é lead.';
comment on column public.site_leads.confirm_token_hash is
  'SHA-256 do token de confirmação. O token em claro só existe no e-mail.';

-- ---------------------------------------------------------------------------
-- submit_site_lead — a única porta de entrada pública
--
-- Devolve o token de confirmação para quem chama o enviar por e-mail. Não o
-- devolve ao browser: a Server Action recebe-o no servidor e põe-no no link.
-- ---------------------------------------------------------------------------

create or replace function public.submit_site_lead(
  p_form text,
  p_name text,
  p_email text,
  p_profile_type text,
  p_phone text default null,
  p_reason text default null,
  p_message text default null,
  p_consent_marketing boolean default false,
  p_utm jsonb default '{}'::jsonb,
  p_honeypot text default null,
  p_ip text default null
)
returns table (lead_id uuid, confirm_token text, already_confirmed boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
  v_hash text;
  v_existing public.site_leads%rowtype;
  v_mode text;
  v_source text;

begin
  -- 2. Honeypot primeiro, antes de gastar qualquer trabalho. Sai em silêncio.
  if coalesce(btrim(p_honeypot), '') <> '' then
    return query select null::uuid, null::text, false;
    return;
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email' using hint = 'invalid_email';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'name_required' using hint = 'name_required';
  end if;
  if p_form not in ('preinscricao', 'contacto', 'empresas') then
    raise exception 'invalid_form' using hint = 'invalid_form';
  end if;
  if p_profile_type not in ('owner', 'buyer', 'empresa') then
    raise exception 'invalid_profile_type' using hint = 'invalid_profile_type';
  end if;

  -- 1. Rate limit por volume de IP: cinco submissões por quarto de hora. Um
  -- humano a corrigir um erro de escrita cabe lá dentro com folga; um bot
  -- não. O registo entra mesmo quando passa, senão o contador nunca sobe.
  if p_ip is not null and btrim(p_ip) <> '' then
    if not public.check_submission_rate_limit(p_ip, 'site_lead', 5) then
      raise exception 'rate_limited' using hint = 'rate_limited';
    end if;
    insert into public.auth_attempts (identifier, kind, succeeded)
    values (lower(p_ip), 'site_lead', true);
  end if;

  -- `source` acompanha o modo do site: um lead recolhido em pré-lançamento é
  -- outra coisa de um recolhido depois, e o CRM do Admin filtra por isso.
  select value #>> '{}' into v_mode from public.feature_flags where key = 'launch_mode';
  v_source := case when v_mode = 'post' then 'post_launch' else 'pre_launch' end;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  -- 4. Dedupe por (e-mail, formulário). Reenviar devolve o mesmo registo.
  select * into v_existing
  from public.site_leads
  where lower(email) = v_email and form = p_form
  order by created_at desc
  limit 1;

  if v_existing.id is not null then
    if v_existing.confirmed_at is not null then
      -- Já confirmado: nada a reenviar, e dizemos isso a quem chama para a
      -- página não prometer um e-mail que não vai sair.
      return query select v_existing.id, null::text, true;
      return;
    end if;

    update public.site_leads
    set name = btrim(p_name),
        phone = nullif(btrim(coalesce(p_phone, '')), ''),
        reason = nullif(btrim(coalesce(p_reason, '')), ''),
        message = nullif(btrim(coalesce(p_message, '')), ''),
        profile_type = p_profile_type,
        utm = coalesce(p_utm, '{}'::jsonb),
        confirm_token_hash = v_hash,
        updated_at = now()
    where id = v_existing.id;

    return query select v_existing.id, v_token, false;
    return;
  end if;

  insert into public.site_leads (
    source, form, name, email, phone, profile_type, reason, message, utm,
    consent_marketing, consent_at, confirm_token_hash
  )
  values (
    v_source, p_form, btrim(p_name), v_email,
    nullif(btrim(coalesce(p_phone, '')), ''), p_profile_type,
    nullif(btrim(coalesce(p_reason, '')), ''),
    nullif(btrim(coalesce(p_message, '')), ''),
    coalesce(p_utm, '{}'::jsonb),
    coalesce(p_consent_marketing, false),
    case when coalesce(p_consent_marketing, false) then now() else null end,
    v_hash
  )
  returning id into v_existing.id;

  return query select v_existing.id, v_token, false;
end;
$$;

revoke all on function public.submit_site_lead(
  text, text, text, text, text, text, text, boolean, jsonb, text, text
) from public;
-- `anon` **e** `authenticated`: o formulário de contacto da home também serve
-- quem já tem sessão aberta noutro separador.
grant execute on function public.submit_site_lead(
  text, text, text, text, text, text, text, boolean, jsonb, text, text
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- confirm_site_lead — o segundo passo do double opt-in
--
-- Compara o **hash**, nunca o token. Idempotente: confirmar duas vezes com o
-- mesmo link devolve sucesso, porque quem clica outra vez não fez nada de
-- errado e um erro aí só assustaria.
-- ---------------------------------------------------------------------------

create or replace function public.confirm_site_lead(p_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_hash text := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_id uuid;
begin
  select id into v_id from public.site_leads where confirm_token_hash = v_hash;
  if v_id is null then
    return false;
  end if;

  update public.site_leads
  set confirmed_at = coalesce(confirmed_at, now()),
      -- O token morre no primeiro uso. Um link de confirmação reutilizável é
      -- um link que fica num histórico de browser partilhado.
      confirm_token_hash = null,
      updated_at = now()
  where id = v_id;

  return true;
end;
$$;

revoke all on function public.confirm_site_lead(text) from public;
grant execute on function public.confirm_site_lead(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Purga das inscrições nunca confirmadas
--
-- 30 dias. Um e-mail que nunca foi confirmado não é um lead: é um endereço
-- que alguém escreveu, possivelmente de outra pessoa, e guardá-lo para sempre
-- é retenção sem base legal.
-- ---------------------------------------------------------------------------

create or replace function public.purge_unconfirmed_site_leads()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.site_leads
  where confirmed_at is null and created_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_unconfirmed_site_leads() from public, anon;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.schedule(
      'upm-purge-unconfirmed-site-leads', '45 4 * * *',
      'select public.purge_unconfirmed_site_leads()'
    );
  end if;
end;
$$;

comment on table public.site_leads is
  'Site prospects; private to Admin. Entrada pública por submit_site_lead (P2-02), '
  'com double opt-in, honeypot e rate limit por IP. O CAPTCHA é dívida própria.';
