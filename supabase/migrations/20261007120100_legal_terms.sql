-- UProperty Market — Fase 9, 2/6
--
-- P9-02 — Termos versionados e aceitação registada.
--
-- A regra que manda neste ficheiro: **nunca um booleano**. Tem de ser possível
-- dizer, de cada pessoa, que versão concreta do documento ela aceitou, quando,
-- de que endereço, e com que conteúdo exato — por isso a aceitação guarda o
-- `content_hash` da versão, e não só o número dela. Um número pode ser
-- reescrito; um hash do corpo não.
--
-- `review_state` existe porque a primeira versão do texto é uma **MINUTA PARA
-- REVISÃO JURÍDICA** (P9-02) e, ao mesmo tempo, o registo não pode funcionar
-- sem um documento publicado. Separar "está publicado" de "já foi revisto por
-- quem sabe" deixa as duas coisas serem verdade sem mentir a ninguém: a app
-- mostra o aviso, a base de dados sabe que o aviso existe, e P11-07 fecha-o
-- quando a revisão chegar.

-- pgcrypto (hmac, digest, gen_random_bytes) vive em `extensions` num projeto
-- Supabase e em `public` num Postgres criado à mão. O search_path desta
-- transação cobre os dois casos; os objetos novos nascem em `public`, que é o
-- primeiro da lista.
set search_path = public, extensions;

create type public.legal_document_kind as enum (
  'terms',
  'privacy',
  'cookies',
  'data_protection'
);

create type public.legal_review_state as enum (
  'draft_pending_legal_review',
  'legally_reviewed'
);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind public.legal_document_kind not null,
  version text not null check (length(btrim(version)) between 1 and 32),
  locale text not null check (locale in ('pt', 'en')),
  title text not null,
  body_md text not null,
  -- sha256 do corpo. Escrito por trigger, não pela aplicação: um hash que a
  -- aplicação pudesse escolher não prova nada.
  content_hash text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  review_state public.legal_review_state not null default 'draft_pending_legal_review',
  effective_from timestamptz,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, version, locale)
);

create index legal_documents_published_idx
  on public.legal_documents (kind, locale, effective_from desc)
  where status = 'published';

create trigger legal_documents_set_updated_at
  before update on public.legal_documents
  for each row execute function public.set_updated_at();

create or replace function public.legal_document_hash()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.content_hash := encode(digest(new.body_md, 'sha256'), 'hex');
  return new;
end;
$$;

create trigger legal_documents_hash
  before insert or update of body_md on public.legal_documents
  for each row execute function public.legal_document_hash();

comment on table public.legal_documents is
  'Documentos legais com versão e hash do corpo (P9-02). review_state distingue publicado de revisto.';

-- ---------------------------------------------------------------------------
-- terms_acceptances — append-only, e com a versão concreta
--
-- `profile_id` continua a apontar para um perfil anonimizado depois da
-- eliminação da conta (P9-06): o perfil não se apaga, esvazia-se. É isso que
-- deixa este histórico sobreviver sem ficar órfão.
-- ---------------------------------------------------------------------------

create table public.terms_acceptances (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles (id) on delete set null,
  person_identity_id uuid references public.person_identities (id) on delete set null,
  document_id uuid not null references public.legal_documents (id) on delete restrict,
  document_kind public.legal_document_kind not null,
  version text not null,
  content_hash text not null,
  -- Onde foi aceite: no registo, ao contratar, ou numa reaceitação por o
  -- documento ter mudado de versão.
  context text not null check (context in ('registration', 'subscription', 'reacceptance')),
  accepted_at timestamptz not null default now(),
  ip inet,
  user_agent text
);

create index terms_acceptances_profile_idx
  on public.terms_acceptances (profile_id, accepted_at desc);
create index terms_acceptances_identity_idx
  on public.terms_acceptances (person_identity_id, accepted_at desc);
create index terms_acceptances_document_idx on public.terms_acceptances (document_id);

alter table public.legal_documents enable row level security;
alter table public.terms_acceptances enable row level security;

-- O texto publicado é público: tem de poder ser lido antes de haver conta
-- (é o link que o registo abre, e são as páginas de P11-07).
create policy legal_documents_select_published on public.legal_documents
  for select using (status = 'published' or public.is_staff());

create policy legal_documents_admin_write on public.legal_documents
  for all using (public.is_admin()) with check (public.is_admin());

-- Cada um vê as suas aceitações; o staff vê todas. Escrita só por função:
-- append-only de verdade (sem update, sem delete, sem insert de sessão).
create policy terms_acceptances_select_own on public.terms_acceptances
  for select using (profile_id = auth.uid() or public.is_staff());

revoke insert, update, delete on public.terms_acceptances from anon, authenticated;
revoke all on sequence public.terms_acceptances_id_seq from anon, authenticated;

comment on table public.terms_acceptances is
  'Que versão concreta cada pessoa aceitou, quando e de que IP (P9-02). Append-only.';

-- ---------------------------------------------------------------------------
-- current_legal_document — o que o ecrã mostra e o que a aceitação referencia
-- ---------------------------------------------------------------------------

create or replace function public.current_legal_document(
  p_kind public.legal_document_kind,
  p_locale text default 'pt'
)
returns table (
  id uuid,
  kind public.legal_document_kind,
  version text,
  locale text,
  title text,
  body_md text,
  content_hash text,
  review_state public.legal_review_state,
  effective_from timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.kind, d.version, d.locale, d.title, d.body_md, d.content_hash,
         d.review_state, d.effective_from
  from public.legal_documents d
  where d.kind = p_kind
    and d.locale = coalesce(nullif(p_locale, ''), 'pt')
    and d.status = 'published'
    and (d.effective_from is null or d.effective_from <= now())
  order by d.effective_from desc nulls last, d.created_at desc
  limit 1;
$$;

grant execute on function public.current_legal_document(public.legal_document_kind, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- record_terms_acceptance — a única porta de escrita
--
-- Aceita um `p_profile_id` explícito porque o registo corre **sem sessão** (o
-- e-mail ainda não está confirmado): quem chama nesse momento é o servidor da
-- app com `service_role`. Com sessão, o perfil é o da sessão e um id de outra
-- pessoa é recusado.
-- ---------------------------------------------------------------------------

create or replace function public.record_terms_acceptance(
  p_document_id uuid,
  p_context text,
  p_ip inet default null,
  p_user_agent text default null,
  p_profile_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := coalesce(p_profile_id, auth.uid());
  v_doc record;
  v_identity uuid;
  v_id bigint;
begin
  if v_profile is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  -- Com sessão, só se aceita por si próprio. Sem sessão (service_role),
  -- `auth.uid()` é null e o id explícito é o caminho do registo.
  if auth.uid() is not null and v_profile <> auth.uid() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  select * into v_doc
  from public.legal_documents
  where id = p_document_id and status = 'published';

  if v_doc.id is null then
    raise exception 'Documento inexistente' using errcode = '22023';
  end if;

  select person_identity_id into v_identity
  from public.profiles where id = v_profile;

  insert into public.terms_acceptances (
    profile_id, person_identity_id, document_id, document_kind,
    version, content_hash, context, ip, user_agent
  )
  values (
    v_profile, v_identity, v_doc.id, v_doc.kind,
    v_doc.version, v_doc.content_hash, p_context, p_ip, left(coalesce(p_user_agent, ''), 400)
  )
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, diff, ip)
  values (
    v_profile,
    'terms.accepted',
    'legal_documents',
    v_doc.id,
    jsonb_build_object(
      'kind', v_doc.kind,
      'version', v_doc.version,
      'content_hash', v_doc.content_hash,
      'context', p_context
    ),
    p_ip
  );

  return v_id;
end;
$$;

revoke all on function public.record_terms_acceptance(uuid, text, inet, text, uuid)
  from public, anon;
grant execute on function public.record_terms_acceptance(uuid, text, inet, text, uuid)
  to authenticated;

comment on function public.record_terms_acceptance(uuid, text, inet, text, uuid) is
  'Registo de aceitação dos Termos, com versão, hash e IP (P9-02). Append-only.';

-- ---------------------------------------------------------------------------
-- terms_acceptance_status — o que falta aceitar, para a app saber se pede
-- reaceitação quando a versão muda
-- ---------------------------------------------------------------------------

create or replace function public.terms_acceptance_status(p_locale text default 'pt')
returns table (
  document_id uuid,
  version text,
  content_hash text,
  review_state public.legal_review_state,
  accepted_at timestamptz,
  accepted_version text,
  needs_acceptance boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_doc record;
  v_acc record;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  select * into v_doc from public.current_legal_document('terms', p_locale);

  select a.* into v_acc
  from public.terms_acceptances a
  where a.profile_id = v_me and a.document_kind = 'terms'
  order by a.accepted_at desc
  limit 1;

  return query select
    v_doc.id,
    v_doc.version,
    v_doc.content_hash,
    v_doc.review_state,
    v_acc.accepted_at,
    v_acc.version,
    -- Compara pelo HASH, não pela versão: se o corpo mudar sem o número
    -- mudar, continua a ser outro documento.
    (v_doc.id is not null and (v_acc.content_hash is null or v_acc.content_hash <> v_doc.content_hash));
end;
$$;

grant execute on function public.terms_acceptance_status(text) to authenticated;
