-- UProperty Market — Fase 9 (Subscrição, Termos e fim da conta gratuita), 1/6
--
-- P9-01 (identidade da conta no registo) e o núcleo de P9-07 (identificador
-- interno permanente e elegibilidade calculada no servidor).
--
-- Decisões do cliente de 7 out 2026 que esta migração implementa:
--
-- 1. **A conta é sempre da pessoa.** O NIF é de pessoa singular, nunca de
--    empresa — por agora, e com validação. Um NIPC não entra aqui: quando
--    existir faturação a uma entidade, o NIPC vive nos dados de faturação do
--    Stripe (`tax_id_collection`, já ligado em P7-02), que NÃO participa na
--    unicidade nem na elegibilidade. Uma pessoa = uma conta.
-- 2. **O que sobrevive à eliminação da conta é o mínimo técnico**, com prazo
--    por definir: `person_identities` guarda HMAC-SHA256 dos identificadores,
--    nunca o valor. A base legal desta retenção TEM de ser validada por quem
--    revê os Termos — este ficheiro não a afirma.
--
-- Três notas de leitura:
--
-- - O NIF é dado pessoal. Fica em `profiles`, que já é fechada à sessão do
--   próprio e ao staff, e **nunca** em `properties_public`, em props de
--   cliente ou no perfil público (08 §6.3).
-- - O NIF não se altera livremente (P9-01). A sessão não tem privilégio de
--   escrita nessa coluna: a lista branca de `grant update` de
--   `20261001120100` não a inclui, e não é alargada aqui. A alteração fica
--   para um fluxo próprio, com ID próprio.
-- - As mensagens de erro são genéricas por desenho. Dizer "este NIF já existe"
--   é confirmar a terceiros que uma pessoa concreta tem conta nesta
--   plataforma — é enumeração de contas por outro campo (08 §7.6).

-- pgcrypto (hmac, digest, gen_random_bytes) vive em `extensions` num projeto
-- Supabase e em `public` num Postgres criado à mão. O search_path desta
-- transação cobre os dois casos; os objetos novos nascem em `public`, que é o
-- primeiro da lista.
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- `deleted` entra em profile_status
--
-- A eliminação da conta é P9-06 e vive na 4.ª migração desta fase, mas o
-- estado nasce aqui porque a elegibilidade de registo já tem de o distinguir:
-- uma conta eliminada não ocupa o NIF, uma conta viva ocupa.
-- ---------------------------------------------------------------------------

alter type public.profile_status add value if not exists 'deleted';

-- ---------------------------------------------------------------------------
-- Segredo de derivação (pepper) — fica fora do alcance de qualquer sessão
--
-- Sem pepper, um hash de NIF é adivinhável: o espaço de NIFs válidos é
-- pequeno e percorre-se numa tarde. Com pepper, quem leia a tabela não
-- consegue reverter nada sem ter também este segredo.
--
-- Gerado pela migração, por ambiente. É de propósito que dev, staging e
-- produção não partilhem hashes: não há como cruzar bases.
-- ---------------------------------------------------------------------------

create table public.identity_secrets (
  key text primary key,
  secret bytea not null,
  created_at timestamptz not null default now()
);

alter table public.identity_secrets enable row level security;
-- Sem policy nenhuma: a RLS fecha-a a toda a gente menos à `service_role`, e
-- o revoke tira-a também da superfície do PostgREST (08 §3.5).
revoke all on public.identity_secrets from anon, authenticated;

insert into public.identity_secrets (key, secret)
values ('person_identity', gen_random_bytes(32));

comment on table public.identity_secrets is
  'Pepper de derivação dos hashes de identidade (P9-07). Nunca legível por uma sessão.';

-- ---------------------------------------------------------------------------
-- Validação do NIF português — pessoa singular
--
-- Nove dígitos, dígito de controlo por módulo 11 com pesos 9..2.
--
-- Prefixos aceites, por a conta ser SEMPRE de uma pessoa (decisão do cliente,
-- 7 out 2026): `1`, `2` e `3` (pessoa singular) e `45` (pessoa singular não
-- residente). Ficam de fora `5` (pessoa coletiva), `6` (administração
-- pública), `7x` (heranças e outras entidades), `8` (não residente sem
-- estabelecimento) e `9x` (condomínios e irregulares).
-- ---------------------------------------------------------------------------

create or replace function public.is_valid_pt_nif(p_value text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_digits text := regexp_replace(coalesce(p_value, ''), '\D', '', 'g');
  v_sum integer := 0;
  v_check integer;
  i integer;
begin
  if length(v_digits) <> 9 then
    return false;
  end if;

  if not (
    left(v_digits, 1) in ('1', '2', '3')
    or left(v_digits, 2) = '45'
  ) then
    return false;
  end if;

  for i in 1..8 loop
    v_sum := v_sum + (substr(v_digits, i, 1))::integer * (10 - i);
  end loop;

  v_check := 11 - (v_sum % 11);
  if v_check >= 10 then
    v_check := 0;
  end if;

  return v_check = (substr(v_digits, 9, 1))::integer;
end;
$$;

comment on function public.is_valid_pt_nif(text) is
  'NIF português de PESSOA SINGULAR: 9 dígitos, módulo 11, prefixos 1/2/3/45 (P9-01).';

-- ---------------------------------------------------------------------------
-- Normalização — para que o mesmo número escrito de duas maneiras dê o mesmo
-- hash. Sem isto, "+351 912 345 678" e "912345678" seriam duas pessoas.
-- ---------------------------------------------------------------------------

create or replace function public.normalize_phone(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  v text := regexp_replace(coalesce(p_value, ''), '[\s\-\.\(\)]', '', 'g');
begin
  if v = '' then
    return null;
  end if;
  if left(v, 2) = '00' then
    v := '+' || substr(v, 3);
  end if;
  -- Nove dígitos sem indicativo lêem-se como portugueses: é o mercado da
  -- plataforma, e um número internacional escreve-se sempre com `+`.
  if v ~ '^[0-9]{9}$' then
    v := '+351' || v;
  end if;
  if v !~ '^\+[0-9]{8,15}$' then
    return null;
  end if;
  return v;
end;
$$;

create or replace function public.normalize_email(p_value text)
returns text
language sql
immutable
as $$
  select nullif(lower(btrim(coalesce(p_value, ''))), '');
$$;

-- ---------------------------------------------------------------------------
-- hash_identity — HMAC-SHA256 com o pepper. Nunca o valor.
--
-- O `kind` entra no texto assinado para que o mesmo dígito a fazer de NIF e
-- de telefone não dê o mesmo hash.
-- ---------------------------------------------------------------------------

create or replace function public.hash_identity(p_kind text, p_value text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_secret bytea;
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;

  select secret into v_secret
  from public.identity_secrets
  where key = 'person_identity';

  if v_secret is null then
    raise exception 'Segredo de identidade em falta' using errcode = '55000';
  end if;

  -- `hmac` é do pgcrypto. A extensão foi instalada sem schema explícito na
  -- migração base, por isso vive em `public`; `extensions` fica no
  -- search_path para o caso de ser movida (é onde o PostGIS está, 07 §17.3).
  return encode(hmac(p_kind || ':' || lower(btrim(p_value)), v_secret, 'sha256'), 'hex');
end;
$$;

revoke all on function public.hash_identity(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- person_identities — o identificador interno PERMANENTE (P9-07)
--
-- É esta linha, e não `profiles`, que sobrevive à eliminação da conta. Guarda
-- só hashes: quem a ler não fica a saber de quem é.
--
-- `retention_until` nasce a NULL de propósito: o prazo de retenção não está
-- decidido e não se inventa aqui (07 §16.1 e a decisão (b) de 7 out 2026).
-- Uma purga futura filtra por esta coluna; enquanto for null, não há purga.
-- ---------------------------------------------------------------------------

create table public.person_identities (
  id uuid primary key default gen_random_uuid(),
  tax_id_hash text not null unique,
  phone_hash text,
  email_hash text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Preenchido quando a última conta ligada a esta identidade é eliminada.
  last_account_deleted_at timestamptz,
  -- NULL = prazo por definir (decisão do cliente + revisão jurídica).
  retention_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index person_identities_phone_hash_idx on public.person_identities (phone_hash)
  where phone_hash is not null;
create index person_identities_email_hash_idx on public.person_identities (email_hash)
  where email_hash is not null;
create index person_identities_retention_idx on public.person_identities (retention_until)
  where retention_until is not null;

create trigger person_identities_set_updated_at
  before update on public.person_identities
  for each row execute function public.set_updated_at();

alter table public.person_identities enable row level security;
revoke all on public.person_identities from anon, authenticated;

comment on table public.person_identities is
  'Identificador interno permanente por pessoa (P9-07). Só hashes HMAC, nunca o valor. '
  'Sobrevive à eliminação da conta; retention_until por definir.';

-- ---------------------------------------------------------------------------
-- offer_redemptions — o histórico de ofertas de que a elegibilidade depende
--
-- Hoje não há oferta nenhuma: o cliente decidiu a 7 out 2026 que **não há
-- trial gratuito**. A tabela nasce na mesma, porque é ela que torna a
-- pergunta "esta pessoa já beneficiou de uma oferta?" respondível depois de a
-- conta ser eliminada — que é o requisito de P9-06.
-- ---------------------------------------------------------------------------

create table public.offer_redemptions (
  id bigint generated always as identity primary key,
  person_identity_id uuid not null references public.person_identities (id) on delete restrict,
  offer_kind text not null check (length(btrim(offer_kind)) between 2 and 64),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  granted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (person_identity_id, offer_kind)
);

create index offer_redemptions_subscription_idx on public.offer_redemptions (subscription_id);

alter table public.offer_redemptions enable row level security;
revoke all on public.offer_redemptions from anon, authenticated;

comment on table public.offer_redemptions is
  'Que ofertas cada identidade já consumiu (P9-07). Uma por (identidade, oferta).';

-- ---------------------------------------------------------------------------
-- profiles ganha o NIF e a ligação à identidade permanente
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column tax_id text,
  add column tax_id_set_at timestamptz,
  add column person_identity_id uuid references public.person_identities (id) on delete set null;

alter table public.profiles
  add constraint profiles_tax_id_valid
  check (tax_id is null or public.is_valid_pt_nif(tax_id));

-- Unicidade: dois perfis nunca partilham NIF (P9-01). Parcial, porque as
-- contas anteriores a esta fase ainda não o têm.
create unique index profiles_tax_id_key on public.profiles (tax_id)
  where tax_id is not null;

create index profiles_person_identity_idx on public.profiles (person_identity_id);

comment on column public.profiles.tax_id is
  'NIF de pessoa singular. DADO PESSOAL: nunca em properties_public, props de cliente '
  'ou perfil público. Não escrevível pela sessão — ver grant update de 20261001120100.';

-- ---------------------------------------------------------------------------
-- signup_eligibility — a elegibilidade decide-se NO SERVIDOR (P9-07)
--
-- Devolve o mínimo: se pode avançar e, quando não pode, um código que o
-- chamador NÃO mostra ao utilizador — a mensagem visível é sempre a mesma.
--
-- `service_role` apenas: o registo corre sem sessão (o e-mail ainda não está
-- confirmado), por isso quem chama é o servidor da app, não o browser.
-- ---------------------------------------------------------------------------

create or replace function public.signup_eligibility(
  p_tax_id text,
  p_phone text,
  p_email text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tax_hash text;
  v_identity record;
  v_taken boolean;
begin
  if not public.is_valid_pt_nif(p_tax_id) then
    return jsonb_build_object('allowed', false, 'code', 'invalid_tax_id');
  end if;

  if public.normalize_phone(p_phone) is null then
    return jsonb_build_object('allowed', false, 'code', 'invalid_phone');
  end if;

  if public.normalize_email(p_email) is null then
    return jsonb_build_object('allowed', false, 'code', 'invalid_email');
  end if;

  -- Uma conta VIVA com este NIF bloqueia. Uma conta eliminada não bloqueia a
  -- criação de uma nova — bloqueia apenas a repetição de uma oferta, e isso
  -- lê-se de `offer_redemptions`, não daqui.
  select exists (
    select 1 from public.profiles pr
    where pr.tax_id = regexp_replace(p_tax_id, '\D', '', 'g')
      and pr.status <> 'deleted'
  ) into v_taken;

  if v_taken then
    return jsonb_build_object('allowed', false, 'code', 'tax_id_in_use');
  end if;

  v_tax_hash := public.hash_identity('tax_id', regexp_replace(p_tax_id, '\D', '', 'g'));

  select * into v_identity
  from public.person_identities
  where tax_id_hash = v_tax_hash;

  return jsonb_build_object(
    'allowed', true,
    'known_identity', v_identity.id is not null,
    'person_identity_id', v_identity.id,
    'redeemed_offers', coalesce(
      (
        select jsonb_agg(o.offer_kind order by o.offer_kind)
        from public.offer_redemptions o
        where o.person_identity_id = v_identity.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.signup_eligibility(text, text, text) from public, anon, authenticated;

comment on function public.signup_eligibility(text, text, text) is
  'Elegibilidade de registo calculada no servidor (P9-07). O código de recusa é interno: '
  'a mensagem visível é sempre genérica (P9-01).';

-- ---------------------------------------------------------------------------
-- register_account_identity — grava NIF, telefone e identidade permanente
--
-- Corre uma vez, logo a seguir ao `signUp`, com `service_role` (ainda não há
-- sessão). É aqui que o NIF entra em `profiles`, e é o único sítio onde entra.
-- ---------------------------------------------------------------------------

create or replace function public.register_account_identity(
  p_profile_id uuid,
  p_tax_id text,
  p_phone text,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tax text := regexp_replace(coalesce(p_tax_id, ''), '\D', '', 'g');
  v_phone text := public.normalize_phone(p_phone);
  v_email text := public.normalize_email(p_email);
  v_identity_id uuid;
begin
  if not public.is_valid_pt_nif(v_tax) then
    raise exception 'Identidade inválida' using errcode = '22023';
  end if;
  if v_phone is null or v_email is null then
    raise exception 'Identidade inválida' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Perfil inexistente' using errcode = '22023';
  end if;

  insert into public.person_identities (tax_id_hash, phone_hash, email_hash)
  values (
    public.hash_identity('tax_id', v_tax),
    public.hash_identity('phone', v_phone),
    public.hash_identity('email', v_email)
  )
  on conflict (tax_id_hash) do update
    set last_seen_at = now(),
        phone_hash = coalesce(excluded.phone_hash, public.person_identities.phone_hash),
        email_hash = coalesce(excluded.email_hash, public.person_identities.email_hash)
  returning id into v_identity_id;

  update public.profiles
     set tax_id = v_tax,
         tax_id_set_at = now(),
         phone = v_phone,
         person_identity_id = v_identity_id
   where id = p_profile_id;

  -- 08 §6.7: a criação da conta é ação sensível e fica no registo. O `diff`
  -- NÃO leva o NIF nem o telefone (08 §6.3) — leva a identidade, que é opaca.
  insert into public.audit_log (actor_id, action, entity, entity_id, diff)
  values (
    p_profile_id,
    'account.identity_registered',
    'profiles',
    p_profile_id,
    jsonb_build_object('person_identity_id', v_identity_id)
  );

  return v_identity_id;
end;
$$;

revoke all on function public.register_account_identity(uuid, text, text, text)
  from public, anon, authenticated;

comment on function public.register_account_identity(uuid, text, text, text) is
  'Liga um perfil ao NIF e à identidade permanente, no registo (P9-01/P9-07). service_role apenas.';
