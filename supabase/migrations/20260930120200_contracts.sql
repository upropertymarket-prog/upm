-- UProperty Market — migração da Fase 6 (Cloud e contratos), parte 3/3
--
-- Cobre P6-03 (Contract Editor) e P6-04 (Templates de contrato no Admin, com
-- versões). Referências: 05 §6.5 (modelos e contratos), 03 F7 (fluxo),
-- 04 §8.3 (editor) e §8.5 (Admin), 07 §5.5 (contract_shares), 07 §13.2 e
-- §13.4 (versões e quem vê o histórico).
--
-- Distinção que atravessa tudo (05 §6.5): um MODELO é texto com variáveis e
-- pertence à administração; um CONTRATO é gerado de um modelo, tem valores
-- concretos e pertence ao proprietário. Nunca se editam no mesmo sítio.

-- ---------------------------------------------------------------------------
-- Modelos — 05 §6.5 e P6-04
--
-- "Com versões": publicar uma versão nova não altera a anterior, cria uma
-- linha nova com `version + 1` e arquiva a que estava publicada. Um contrato
-- já gerado guarda `template_version` e continua a apontar para o texto que
-- lhe deu origem — senão, corrigir um modelo reescrevia contratos assinados.
--
-- `family_id` agrupa as versões do mesmo modelo. 05 §6.5 não dava uma chave de
-- família, e usar (kind, name) tornava um simples renomear numa família nova.
-- A primeira versão é a sua própria família; as seguintes herdam-na.
-- ---------------------------------------------------------------------------

create type public.contract_kind as enum ('sale', 'rent');
create type public.contract_template_status as enum ('draft', 'published', 'archived');

create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  kind public.contract_kind not null,
  name text not null check (length(btrim(name)) between 1 and 160),
  version integer not null default 1 check (version >= 1),
  -- Documento TipTap, com nós `variable` (04 §8.3: variáveis em chip).
  body jsonb not null default '{}'::jsonb,
  variables text[] not null default '{}',
  status public.contract_template_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, version)
);

-- Uma só versão publicada por família: é a que o proprietário vê na lista.
create unique index contract_templates_one_published
  on public.contract_templates (family_id) where status = 'published';

create index contract_templates_kind_idx
  on public.contract_templates (kind, status);

create trigger contract_templates_set_updated_at
  before update on public.contract_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Contratos — 05 §6.5
--
-- O ciclo de 04 §8.3 é manual na v1: Rascunho → Partilhado → Por assinar →
-- Assinado → Concluído. `status_rank` existe para o tornar verificável — ver
-- `set_contract_status` mais abaixo.
-- ---------------------------------------------------------------------------

create type public.contract_status as enum (
  'draft', 'shared', 'awaiting_signature', 'signed', 'completed'
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  template_id uuid references public.contract_templates (id) on delete set null,
  template_version integer,
  property_id uuid references public.properties (id) on delete set null,
  counterparty_profile_id uuid references public.profiles (id) on delete set null,
  counterparty_name text not null default '',
  kind public.contract_kind not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  body jsonb not null default '{}'::jsonb,
  "values" jsonb not null default '{}'::jsonb,
  status public.contract_status not null default 'draft',
  shared_at timestamptz,
  completed_at timestamptz,
  current_version integer not null default 0 check (current_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contracts_owner_idx on public.contracts (owner_id, status);
create index contracts_counterparty_idx on public.contracts (counterparty_profile_id)
  where counterparty_profile_id is not null;
create index contracts_property_idx on public.contracts (property_id)
  where property_id is not null;

create trigger contracts_set_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Versões de contrato — 07 §13.2
--
-- Nem toda a tecla gera versão: uma por sessão de edição (ao fechar, ao mudar
-- de estado, ou após 5 min de inatividade) e SEMPRE que o estado muda.
-- Partilhar ou marcar como assinado congela a versão dessa altura: o que a
-- contraparte viu fica registado e não pode ser reescrito por trás.
-- ---------------------------------------------------------------------------

create table public.contract_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  version integer not null check (version >= 1),
  body jsonb not null,
  "values" jsonb not null default '{}'::jsonb,
  status_at_save public.contract_status not null,
  -- Marcada quando a versão foi congelada por uma mudança de estado: é a que
  -- a contraparte viu, e é a que o separador Histórico destaca.
  frozen boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  note text,
  unique (contract_id, version)
);

create index contract_versions_contract_idx
  on public.contract_versions (contract_id, version desc);

-- ---------------------------------------------------------------------------
-- Partilha de contratos — 07 §5.5
--
-- Tabela própria, separada de `file_shares`, porque o que se partilha é outra
-- coisa: o contrato partilhado aparece em `/contratos` da contraparte em
-- leitura, com "Guardar na Cloud" e "Transferir PDF". `file_shares` continua
-- a servir só a Cloud.
--
-- `permission` é `view | download` — nunca `edit` (07 §5.5 e §19.7).
-- ---------------------------------------------------------------------------

create table public.contract_shares (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  shared_by uuid not null references public.profiles (id) on delete cascade,
  shared_with_profile_id uuid references public.profiles (id) on delete cascade,
  token text unique,
  permission public.share_permission not null default 'view',
  expires_at timestamptz,
  access_code_hash text,
  revoked_at timestamptz,
  -- A versão congelada que esta partilha mostra (07 §13.2).
  version_id uuid references public.contract_versions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_shares_person_xor_link check (
    (shared_with_profile_id is not null and token is null)
    or (shared_with_profile_id is null and token is not null)
  )
);

create unique index contract_shares_one_per_person
  on public.contract_shares (contract_id, shared_with_profile_id)
  where shared_with_profile_id is not null and revoked_at is null;

create index contract_shares_contract_idx on public.contract_shares (contract_id);
create index contract_shares_with_idx on public.contract_shares (shared_with_profile_id)
  where shared_with_profile_id is not null and revoked_at is null;

create trigger contract_shares_set_updated_at
  before update on public.contract_shares
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.contract_templates enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_versions enable row level security;
alter table public.contract_shares enable row level security;

-- Modelos: o proprietário vê os PUBLICADOS (é deles que gera um contrato);
-- rascunhos e arquivados são só do admin. Escrita só admin (P6-04, 07 §4.1).
create policy contract_templates_select_published on public.contract_templates
  for select using (status = 'published' or public.is_admin());

create policy contract_templates_admin_write on public.contract_templates
  for all using (public.is_admin()) with check (public.is_admin());

-- Contratos: o dono, a contraparte com partilha ativa, e o admin.
-- O `support` não entra — é a mesma linha de D30: sem caminho auditado, não
-- se abre acesso a conteúdo de utilizadores.
create policy contracts_select_involved on public.contracts
  for select using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.contract_shares s
      where s.contract_id = contracts.id
        and s.shared_with_profile_id = auth.uid()
        and s.revoked_at is null
        and (s.expires_at is null or s.expires_at > now())
    )
  );

-- Escrever é só do dono. A contraparte tem LEITURA (07 §5.5) — não há
-- permissão de edição numa partilha de contrato.
create policy contracts_owner_write on public.contracts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Versões: o dono vê todas; a contraparte só a versão que lhe foi partilhada
-- (07 §13.4 — "só as versões que lhe foram partilhadas").
create policy contract_versions_select_scoped on public.contract_versions
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.contracts c
      where c.id = contract_versions.contract_id and c.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.contract_shares s
      where s.contract_id = contract_versions.contract_id
        and s.version_id = contract_versions.id
        and s.shared_with_profile_id = auth.uid()
        and s.revoked_at is null
        and (s.expires_at is null or s.expires_at > now())
    )
  );

create policy contract_shares_select_involved on public.contract_shares
  for select using (
    shared_by = auth.uid()
    or shared_with_profile_id = auth.uid()
    or public.is_admin()
  );

create policy contract_shares_owner_write on public.contract_shares
  for all using (
    shared_by = auth.uid()
    and exists (
      select 1 from public.contracts c
      where c.id = contract_shares.contract_id and c.owner_id = auth.uid()
    )
  ) with check (
    shared_by = auth.uid()
    and exists (
      select 1 from public.contracts c
      where c.id = contract_shares.contract_id and c.owner_id = auth.uid()
    )
  );

-- O registo de acessos de um CONTRATO é do dono do contrato (07 §13.4: a
-- contraparte NÃO vê o registo de acessos). Policy à parte da de `files`, em
-- 20260930120000_cloud.sql — as policies somam-se.
create policy document_access_log_select_contract on public.document_access_log
  for select using (
    subject_type = 'contract'
    and exists (
      select 1 from public.contracts c
      where c.id = document_access_log.subject_id and c.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Modelos — publicar uma versão nova (P6-04)
-- ---------------------------------------------------------------------------

create or replace function public.publish_contract_template(p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tpl public.contract_templates;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  select * into v_tpl from public.contract_templates where id = p_template_id;
  if v_tpl.id is null then
    raise exception 'Modelo inexistente' using errcode = 'P0002';
  end if;
  if v_tpl.status <> 'draft' then
    raise exception 'Só um rascunho se publica' using errcode = '42501';
  end if;

  -- A versão que estava publicada passa a arquivada; os contratos já gerados
  -- continuam a apontar para ela por `template_version`.
  update public.contract_templates
  set status = 'archived'
  where family_id = v_tpl.family_id and status = 'published';

  update public.contract_templates
  set status = 'published'
  where id = p_template_id;

  return p_template_id;
end;
$$;

-- Nova versão de rascunho a partir da publicada — o "editar modelo" do Admin
-- nunca mexe no texto que está a ser usado.
create or replace function public.draft_contract_template_version(p_family_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.contract_templates;
  v_new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  select * into v_src from public.contract_templates
  where family_id = p_family_id
  order by version desc
  limit 1;

  if v_src.id is null then
    raise exception 'Modelo inexistente' using errcode = 'P0002';
  end if;
  if v_src.status = 'draft' then
    return v_src.id;  -- já há um rascunho aberto
  end if;

  insert into public.contract_templates (
    family_id, kind, name, version, body, variables, status, created_by
  ) values (
    v_src.family_id, v_src.kind, v_src.name, v_src.version + 1,
    v_src.body, v_src.variables, 'draft', auth.uid()
  ) returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gerar um contrato a partir de um modelo (03 F7)
-- ---------------------------------------------------------------------------

create or replace function public.create_contract_from_template(
  p_template_id uuid,
  p_title text,
  p_property_id uuid default null,
  p_counterparty_profile_id uuid default null,
  p_counterparty_name text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_tpl public.contract_templates;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  select * into v_tpl from public.contract_templates
  where id = p_template_id and status = 'published';
  if v_tpl.id is null then
    raise exception 'Modelo indisponível' using errcode = 'P0002';
  end if;

  if p_property_id is not null and not exists (
    select 1 from public.properties where id = p_property_id and owner_id = v_me
  ) then
    raise exception 'O imóvel não é seu' using errcode = '42501';
  end if;

  insert into public.contracts (
    owner_id, template_id, template_version, property_id,
    counterparty_profile_id, counterparty_name, kind, title, body
  ) values (
    v_me, v_tpl.id, v_tpl.version, p_property_id,
    p_counterparty_profile_id, coalesce(p_counterparty_name, ''),
    v_tpl.kind, p_title, v_tpl.body
  ) returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Versões — 07 §13.2
--
-- `save_contract_version` é o autosave do editor a fechar uma sessão de
-- edição. `p_freeze` marca a versão como congelada — é o que
-- `set_contract_status` usa quando partilhar ou assinar fixa o que a
-- contraparte viu.
-- ---------------------------------------------------------------------------

create or replace function public.save_contract_version(
  p_contract_id uuid,
  p_body jsonb,
  p_values jsonb default '{}'::jsonb,
  p_note text default null,
  p_freeze boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_contract public.contracts;
  v_next integer;
  v_version_id uuid;
begin
  select * into v_contract from public.contracts where id = p_contract_id;
  if v_contract.id is null then
    raise exception 'Contrato inexistente' using errcode = 'P0002';
  end if;
  if v_contract.owner_id <> v_me then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  v_next := v_contract.current_version + 1;

  insert into public.contract_versions (
    contract_id, version, body, "values", status_at_save, frozen, created_by, note
  ) values (
    p_contract_id, v_next, p_body, p_values, v_contract.status, p_freeze, v_me, p_note
  ) returning id into v_version_id;

  update public.contracts
  set body = p_body, "values" = p_values, current_version = v_next
  where id = p_contract_id;

  return v_version_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Estado do contrato
--
-- 04 §8.3 descreve o ciclo como Rascunho → Partilhado → Por assinar →
-- Assinado → Concluído, manual na v1. A ordem é a do documento; o que esta
-- função acrescenta é torná-la verificável: um estado nunca anda para trás.
--
-- DECISÃO DO AGENTE, por registar em 07: o doc dá a ordem mas não diz se se
-- pode recuar. Recuar não tem significado documentado — um contrato que já foi
-- partilhado não volta a não o ter sido — e as versões congeladas de §13.2
-- existem precisamente para o histórico não ser reescrito por trás. Fica
-- só-para-a-frente, e a decisão vai ao cliente no fim da fase.
-- ---------------------------------------------------------------------------

create or replace function public.contract_status_rank(p_status public.contract_status)
returns integer
language sql
immutable
as $$
  select case p_status
    when 'draft' then 0
    when 'shared' then 1
    when 'awaiting_signature' then 2
    when 'signed' then 3
    when 'completed' then 4
  end;
$$;

create or replace function public.set_contract_status(
  p_contract_id uuid,
  p_status public.contract_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_contract public.contracts;
begin
  select * into v_contract from public.contracts where id = p_contract_id;
  if v_contract.id is null then
    raise exception 'Contrato inexistente' using errcode = 'P0002';
  end if;
  if v_contract.owner_id <> v_me then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if public.contract_status_rank(p_status) <= public.contract_status_rank(v_contract.status) then
    raise exception 'O estado de um contrato não anda para trás' using errcode = '42501';
  end if;

  -- 07 §13.2: mudar de estado congela a versão dessa altura.
  perform public.save_contract_version(
    p_contract_id, v_contract.body, v_contract."values",
    format('Estado: %s', p_status), true
  );

  update public.contracts set
    status = p_status,
    shared_at = case when p_status = 'shared' and shared_at is null then now() else shared_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_contract_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Partilha de contratos — 07 §5.5
-- ---------------------------------------------------------------------------

create or replace function public.share_contract(
  p_contract_id uuid,
  p_permission public.share_permission default 'view',
  p_shared_with uuid default null,
  p_token text default null,
  p_expires_at timestamptz default null,
  p_access_code_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_version_id uuid;
  v_share_id uuid;
begin
  if not exists (select 1 from public.contracts where id = p_contract_id and owner_id = v_me) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if (p_shared_with is null) = (p_token is null) then
    raise exception 'Uma partilha é para uma pessoa OU por ligação' using errcode = '22023';
  end if;

  -- A partilha mostra a versão congelada mais recente (07 §13.2). Se ainda não
  -- houver nenhuma, congela-se uma agora: partilhar sem fixar o que foi
  -- partilhado é exatamente o que o doc não quer.
  select id into v_version_id from public.contract_versions
  where contract_id = p_contract_id and frozen
  order by version desc limit 1;

  if v_version_id is null then
    select public.save_contract_version(
      p_contract_id,
      (select body from public.contracts where id = p_contract_id),
      (select "values" from public.contracts where id = p_contract_id),
      'Congelada ao partilhar', true
    ) into v_version_id;
  end if;

  insert into public.contract_shares (
    contract_id, shared_by, shared_with_profile_id, token, permission,
    expires_at, access_code_hash, version_id
  ) values (
    p_contract_id, v_me, p_shared_with, p_token, p_permission,
    p_expires_at, p_access_code_hash, v_version_id
  )
  on conflict (contract_id, shared_with_profile_id)
    where shared_with_profile_id is not null and revoked_at is null
  do update set
    permission = excluded.permission,
    expires_at = excluded.expires_at,
    version_id = excluded.version_id
  returning id into v_share_id;

  perform public.log_document_access('contract', p_contract_id, 'share_created', v_version_id, v_share_id);
  return v_share_id;
end;
$$;

create or replace function public.revoke_contract_share(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_contract_id uuid;
begin
  select s.contract_id into v_contract_id
  from public.contract_shares s
  join public.contracts c on c.id = s.contract_id
  where s.id = p_share_id and c.owner_id = v_me;

  if v_contract_id is null then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  update public.contract_shares set revoked_at = now()
  where id = p_share_id and revoked_at is null;

  perform public.log_document_access('contract', v_contract_id, 'share_revoked', null, p_share_id);
end;
$$;

create or replace function public.resolve_contract_share(
  p_token text,
  p_access_code_hash text default null
)
returns table (
  share_id uuid,
  contract_id uuid,
  title text,
  body jsonb,
  "values" jsonb,
  permission public.share_permission,
  needs_code boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.contract_shares;
  v_limit jsonb;
begin
  v_limit := public.check_auth_rate_limit(p_token, 'share_code');
  if not (v_limit ->> 'allowed')::boolean then
    raise exception 'Demasiadas tentativas. Tente novamente mais tarde.' using errcode = '53400';
  end if;

  select * into v_share from public.contract_shares
  where token = p_token
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  if v_share.id is null then
    perform public.record_auth_attempt(p_token, 'share_code', false);
    raise exception 'Ligação inválida ou expirada' using errcode = 'P0002';
  end if;

  if v_share.access_code_hash is not null then
    if p_access_code_hash is null then
      return query select v_share.id, v_share.contract_id, null::text,
        null::jsonb, null::jsonb, v_share.permission, true;
      return;
    end if;
    if p_access_code_hash <> v_share.access_code_hash then
      perform public.record_auth_attempt(p_token, 'share_code', false);
      raise exception 'Código incorreto' using errcode = '42501';
    end if;
  end if;

  perform public.record_auth_attempt(p_token, 'share_code', true);

  -- Devolve a VERSÃO CONGELADA, não o corpo atual: é o que 07 §13.2 exige.
  return query
    select v_share.id, c.id, c.title, coalesce(cv.body, c.body),
      coalesce(cv."values", c."values"), v_share.permission, false
    from public.contracts c
    left join public.contract_versions cv on cv.id = v_share.version_id
    where c.id = v_share.contract_id;
end;
$$;

grant execute on function public.resolve_contract_share(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leituras — mesmo padrão da Fase 5 e da parte 2/3: o nome da contraparte e o
-- título do imóvel não se alcançam por `select` com join, por causa da RLS de
-- `profiles` e de `properties`.
-- ---------------------------------------------------------------------------

create or replace function public.my_contracts()
returns table (
  id uuid,
  title text,
  kind public.contract_kind,
  status public.contract_status,
  property_id uuid,
  property_title text,
  counterparty_name text,
  current_version integer,
  share_count integer,
  shared_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.title, c.kind, c.status, c.property_id,
    (select coalesce(nullif(p.title, ''), p.ref) from public.properties p where p.id = c.property_id),
    coalesce(
      nullif(c.counterparty_name, ''),
      (select coalesce(nullif(pr.full_name, ''), 'Utilizador')
        from public.profiles pr where pr.id = c.counterparty_profile_id),
      ''
    ),
    c.current_version,
    (select count(*) from public.contract_shares s
      where s.contract_id = c.id and s.revoked_at is null
        and (s.expires_at is null or s.expires_at > now()))::integer,
    c.shared_at,
    c.updated_at
  from public.contracts c
  where c.owner_id = auth.uid()
  order by c.updated_at desc;
$$;

-- 07 §5.5: o contrato partilhado aparece em /contratos da contraparte, em
-- leitura. Devolve a versão congelada, não o corpo a ser editado.
create or replace function public.contracts_shared_with_me()
returns table (
  contract_id uuid,
  share_id uuid,
  title text,
  kind public.contract_kind,
  status public.contract_status,
  body jsonb,
  "values" jsonb,
  permission public.share_permission,
  shared_by_name text,
  expires_at timestamptz,
  shared_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, s.id, c.title, c.kind, c.status,
    coalesce(cv.body, c.body), coalesce(cv."values", c."values"),
    s.permission,
    coalesce(nullif(owner.full_name, ''), 'Utilizador'),
    s.expires_at, s.created_at
  from public.contract_shares s
  join public.contracts c on c.id = s.contract_id
  join public.profiles owner on owner.id = s.shared_by
  left join public.contract_versions cv on cv.id = s.version_id
  where s.shared_with_profile_id = auth.uid()
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now())
  order by s.created_at desc;
$$;

-- Separador Histórico do editor (07 §13.5): versões com autor, data e nota.
create or replace function public.contract_history(p_contract_id uuid)
returns table (
  version integer,
  version_id uuid,
  status_at_save public.contract_status,
  frozen boolean,
  author_name text,
  created_at timestamptz,
  note text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.version, v.id, v.status_at_save, v.frozen,
    coalesce(nullif(pr.full_name, ''), 'Utilizador'),
    v.created_at, v.note
  from public.contract_versions v
  left join public.profiles pr on pr.id = v.created_by
  where v.contract_id = p_contract_id
    and exists (
      select 1 from public.contracts c
      where c.id = p_contract_id and (c.owner_id = auth.uid() or public.is_admin())
    )
  order by v.version desc;
$$;

-- Os modelos publicados que o proprietário pode usar (04 §8.3, tabs
-- Modelos/Contratos e os tipos Compra e venda / Arrendamento lado a lado).
create or replace function public.available_contract_templates()
returns table (
  id uuid,
  family_id uuid,
  kind public.contract_kind,
  name text,
  version integer,
  variables text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.family_id, t.kind, t.name, t.version, t.variables
  from public.contract_templates t
  where t.status = 'published'
  order by t.kind, t.name;
$$;
