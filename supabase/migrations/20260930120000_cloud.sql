-- UProperty Market — migração da Fase 6 (Cloud e contratos), parte 1/3
--
-- Cobre P6-01 (Cloud: pastas, ficheiros, versões) e a base de P6-02
-- (partilhas), mais o modelo de quota decidido em 07 §19.1–§19.3.
-- Referências: 05 §6.4 (Cloud e partilhas), 07 §13 (histórico e
-- rastreabilidade), 07 §19 (decisões desta fase).
--
-- Duas notas de leitura, para quem chegar aqui depois:
--
-- 1. A Cloud é funcionalidade de plano (07 §19.1). O Gratuito tem
--    `cloud_gb = 0` e a quota resolve-se SEMPRE por `effective_limits()`,
--    nunca lendo `plans.limits` diretamente — senão o extra de §19.3 fica
--    invisível para metade do código.
-- 2. `files` guarda a versão corrente; o conteúdo histórico vive em
--    `file_versions` (07 §13.1). Substituir nunca sobrescreve.

-- ---------------------------------------------------------------------------
-- Extras de subscrição — 07 §19.3
--
-- O extra "Cloud 5 GB" soma-se ao que o plano dá, é único por conta e não
-- levanta mais nenhum limite. As tabelas nascem aqui sem Stripe, exatamente
-- como `plans`/`subscriptions` nasceram na Fase 2 (07 §8.2); a sincronização
-- e o checkout são P7-01 e P7-02.
-- ---------------------------------------------------------------------------

create table public.addons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price_month_cents bigint not null,
  price_year_cents bigint not null,
  stripe_product_id text,
  stripe_price_month_id text,
  stripe_price_year_id text,
  -- O que este extra acrescenta aos limites do plano, chave a chave.
  -- Ex.: {"cloud_gb": 5}. Só as chaves de `plans.limits` são reconhecidas.
  grants jsonb not null default '{}'::jsonb,
  visible boolean not null default true,
  "position" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger addons_set_updated_at
  before update on public.addons
  for each row execute function public.set_updated_at();

create table public.subscription_addons (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  addon_id uuid not null references public.addons (id),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  interval text not null default 'year' check (interval in ('month', 'year')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_subscription_item_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 07 §19.3: uma unidade por conta. Quem precisa de mais capacidade sobe
  -- de plano — é isto que impede o extra de substituir a escada de planos.
  unique (subscription_id, addon_id)
);

create index subscription_addons_subscription_idx
  on public.subscription_addons (subscription_id);

create trigger subscription_addons_set_updated_at
  before update on public.subscription_addons
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- effective_limits — a única fonte de quota (07 §19.3)
--
-- Resolve o plano (subscrição ativa → profiles.plan_id → Gratuito) e soma-lhe
-- os extras ativos. `null` numa chave significa ILIMITADO (07 §19.2) e ganha
-- sempre: somar um extra a "ilimitado" continua a dar ilimitado.
-- ---------------------------------------------------------------------------

create or replace function public.effective_limits(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limits jsonb;
  v_subscription_id uuid;
  v_key text;
  v_bonus numeric;
begin
  select s.id, p.limits
    into v_subscription_id, v_limits
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.profile_id = p_profile_id
    and s.status in ('active', 'trialing')
  order by s.created_at desc
  limit 1;

  if v_limits is null and v_subscription_id is null then
    select p.limits into v_limits
    from public.profiles pr
    join public.plans p on p.id = pr.plan_id
    where pr.id = p_profile_id;
  end if;

  if v_limits is null then
    select p.limits into v_limits from public.plans p where p.slug = 'gratuito';
  end if;

  v_limits := coalesce(v_limits, '{}'::jsonb);

  if v_subscription_id is null then
    return v_limits;
  end if;

  -- Soma dos extras ativos, chave a chave.
  for v_key, v_bonus in
    select g.key, sum((g.value)::numeric)
    from public.subscription_addons sa
    join public.addons a on a.id = sa.addon_id
    cross join lateral jsonb_each_text(a.grants) as g(key, value)
    where sa.subscription_id = v_subscription_id
      and sa.status in ('active', 'trialing')
    group by g.key
  loop
    -- Chave ausente do plano ou a null = ilimitado: o extra não muda nada.
    if v_limits ? v_key and jsonb_typeof(v_limits -> v_key) = 'number' then
      v_limits := jsonb_set(
        v_limits,
        array[v_key],
        to_jsonb(((v_limits ->> v_key)::numeric) + v_bonus)
      );
    end if;
  end loop;

  return v_limits;
end;
$$;

comment on function public.effective_limits(uuid) is
  'Limites efetivos de um perfil: plano + extras ativos (07 §19.2/§19.3). '
  'null numa chave = ilimitado. Nenhum código deve ler plans.limits diretamente.';

-- ---------------------------------------------------------------------------
-- Pastas — 05 §6.4 e 07 §19.5
--
-- `kind` distingue o que é do utilizador do que é de origem do sistema:
--   user               — criada por quem a usa, organiza-se como quiser
--   property           — nasce ao publicar um imóvel (07 §19.1)
--   property_documents — subpasta "Documentos do imóvel", só de leitura
--
-- A app NÃO arruma o que é do utilizador (07 §19.9): estas duas pastas
-- automáticas são a única arrumação imposta, e existem porque o conteúdo é de
-- origem do sistema e está preso à moderação de 07 §5.4.
-- ---------------------------------------------------------------------------

create type public.folder_kind as enum ('user', 'property', 'property_documents');
create type public.cloud_scope as enum ('personal', 'staff');

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.folders (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  kind public.folder_kind not null default 'user',
  -- 05 §1.9: a Cloud interna do Suporte é a mesma tabela com scope='staff'.
  -- As páginas que a usam são da Fase 9; as policies ficam já aqui.
  scope public.cloud_scope not null default 'personal',
  property_id uuid references public.properties (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Só as pastas de origem do sistema estão presas a um imóvel.
  constraint folders_property_only_for_system_kinds check (
    (kind = 'user' and property_id is null)
    or (kind in ('property', 'property_documents') and property_id is not null)
  )
);

-- Uma pasta de imóvel por (dono, imóvel), e uma só subpasta de documentos
-- dentro dela: `ensure_property_folders` é idempotente por causa disto.
create unique index folders_one_per_property
  on public.folders (owner_id, property_id) where kind = 'property';
create unique index folders_one_documents_per_property
  on public.folders (parent_id) where kind = 'property_documents';

create index folders_owner_idx on public.folders (owner_id, parent_id);

create trigger folders_set_updated_at
  before update on public.folders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ficheiros — 05 §6.4 + 07 §13.1
--
-- Desvio técnico declarado a 07 §13.1: em vez de `current_version_id uuid`
-- (FK circular files ↔ file_versions, que obriga a constraint deferrable e a
-- duas escritas para criar um ficheiro), `files` guarda `current_version int`
-- e `file_versions` tem único (file_id, version). É a mesma informação sem o
-- ovo e a galinha; nada do comportamento descrito no doc muda.
--
-- `source` é o que decide se o ficheiro conta para a quota (07 §19.8 #5):
-- `property_document` não conta, tudo o resto conta.
-- ---------------------------------------------------------------------------

create type public.file_source as enum (
  'upload',              -- carregado na Cloud pelo utilizador
  'property_document',   -- documento do imóvel, espelhado (07 §19.5)
  'message_attachment',  -- anexo do chat que o utilizador mandou guardar (§19.6)
  'contract',            -- PDF de contrato guardado na Cloud (07 §5.5)
  'invoice'              -- fatura guardada na Cloud (05 §6.6, Fase 7)
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  scope public.cloud_scope not null default 'personal',
  name text not null check (length(btrim(name)) between 1 and 200),
  mime text not null,
  size bigint not null check (size >= 0),
  -- Em que bucket vive o objeto. Nem tudo o que a Cloud mostra está no bucket
  -- `cloud`: um documento do imóvel espelhado (07 §19.5) continua onde a Fase 4
  -- o pôs, em `documents`, e é o mesmo objeto — não uma cópia. Duplicá-lo daria
  -- duas verdades para o mesmo ficheiro e faria a moderação olhar para uma
  -- delas e a Cloud para a outra.
  bucket text not null default 'cloud' check (bucket in ('cloud', 'documents', 'chat-attachments')),
  storage_path text not null,
  checksum text not null,
  current_version integer not null default 1 check (current_version >= 1),
  property_id uuid references public.properties (id) on delete set null,
  kind text not null default 'outro',
  source public.file_source not null default 'upload',
  -- 07 §13.1: eliminar é soft delete. 07 §19.8 #4: continua a contar para a
  -- quota até `purge_after`, para o ciclo apagar/recarregar não esconder o
  -- consumo. "Esvaziar reciclagem" antecipa a purga.
  deleted_at timestamptz,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index files_owner_idx on public.files (owner_id) where deleted_at is null;
create index files_folder_idx on public.files (folder_id) where deleted_at is null;
create index files_property_idx on public.files (property_id) where property_id is not null;
create index files_deleted_idx on public.files (purge_after) where deleted_at is not null;

create trigger files_set_updated_at
  before update on public.files
  for each row execute function public.set_updated_at();

create table public.file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files (id) on delete cascade,
  version integer not null check (version >= 1),
  bucket text not null default 'cloud' check (bucket in ('cloud', 'documents', 'chat-attachments')),
  storage_path text not null,
  name text not null,
  mime text not null,
  size bigint not null check (size >= 0),
  -- SHA-256: prova que o ficheiro não foi adulterado e deteta duplicados
  -- (07 §13.1).
  checksum text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  note text,
  unique (file_id, version)
);

create index file_versions_file_idx on public.file_versions (file_id, version desc);

-- ---------------------------------------------------------------------------
-- Partilhas de ficheiros — 05 §6.4, 03 F7, 07 §19.7 e §19.11
--
-- `permission` perdeu `edit` (07 §19.7): editar nunca foi uma permissão de
-- partilha. Na Cloud não há editor de ficheiros — substitui-se, e isso cria
-- versão nova.
--
-- Uma partilha é para UMA pessoa OU por ligação, nunca as duas: são dois
-- objetos diferentes na UI (bloco "Com acesso" vs bloco "Ligação").
-- `expires_at` pode ser null — "Sem expirar" mantém-se (07 §19.11).
-- ---------------------------------------------------------------------------

create type public.share_permission as enum ('view', 'download');

create table public.file_shares (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files (id) on delete cascade,
  shared_by uuid not null references public.profiles (id) on delete cascade,
  shared_with uuid references public.profiles (id) on delete cascade,
  token text unique,
  permission public.share_permission not null default 'view',
  expires_at timestamptz,
  access_code_hash text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint file_shares_person_xor_link check (
    (shared_with is not null and token is null)
    or (shared_with is null and token is not null)
  )
);

create unique index file_shares_one_per_person
  on public.file_shares (file_id, shared_with)
  where shared_with is not null and revoked_at is null;

create index file_shares_file_idx on public.file_shares (file_id);
create index file_shares_with_idx on public.file_shares (shared_with)
  where shared_with is not null and revoked_at is null;

create trigger file_shares_set_updated_at
  before update on public.file_shares
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Registo de acessos — 07 §13.3
--
-- Append-only: sem update, sem delete, e NENHUMA policy de escrita a partir do
-- cliente. Só o servidor escreve, por função `security definer` (parte 2/3).
-- `actor_profile_id` fica null num acesso por ligação anónima; nesse caso é o
-- `share_id` que identifica a partilha, e fica o IP.
--
-- Retenção de 2 anos (07 §13.6) — os 90 dias de logs técnicos de 02 §7.3 NÃO
-- se aplicam: isto não é log de sistema, é prova de acesso a documento com
-- valor legal. A purga é `pg_cron`, na parte 2/3.
-- ---------------------------------------------------------------------------

create type public.document_subject as enum (
  'file', 'contract', 'property_document', 'contract_template'
);

create type public.document_action as enum (
  'view', 'download', 'export_pdf', 'print', 'share_created', 'share_revoked'
);

create table public.document_access_log (
  id bigint generated always as identity primary key,
  subject_type public.document_subject not null,
  subject_id uuid not null,
  version_id uuid,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  share_id uuid,
  action public.document_action not null,
  occurred_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  bytes_sent bigint
);

-- 07 §13.7 e doc 08 §4.8/§4.9: índice pensado para a leitura que a UI faz —
-- "os acessos a este documento, do mais recente para o mais antigo".
create index document_access_log_subject_idx
  on public.document_access_log (subject_type, subject_id, occurred_at desc);
create index document_access_log_purge_idx
  on public.document_access_log (occurred_at);

-- ---------------------------------------------------------------------------
-- property_documents ganha `file_id` — fecha D34 (07 §17.1 e §19.5)
--
-- A reconciliação prevista em §17.1 acontece na parte 2/3, em
-- `ensure_property_folders`: cada documento do imóvel passa a ter também uma
-- entrada em `files`, dentro da subpasta "Documentos do imóvel", com
-- `source = 'property_document'` — só de leitura pelo lado da Cloud e fora da
-- quota (07 §19.8 #5).
-- ---------------------------------------------------------------------------

alter table public.property_documents
  add column file_id uuid references public.files (id) on delete set null;

create unique index property_documents_file_idx
  on public.property_documents (file_id) where file_id is not null;

-- ---------------------------------------------------------------------------
-- Buckets — 07 §19.8 #2
--
-- 25 MB por ficheiro, PDF/JPG/PNG, como o protótipo já dizia. O limite do
-- bucket é a rede de segurança; a validação por assinatura de conteúdo (e não
-- pela extensão nem pelo MIME que o browser declara) é da Server Action.
--
-- Buckets novos em vez de reutilizar `documents`: a policy da Fase 4 assume
-- que o primeiro segmento do nome é um property_id e faz-lhe cast para uuid
-- (20260928100000_property_storage.sql). Um objeto da Cloud, cujo primeiro
-- segmento é um owner_id, passaria — mas qualquer prefixo não-uuid partiria a
-- policy existente. Separar os buckets deixa a Fase 4 intocada.
-- Patch proposto a 05 §6.4: a lista de buckets ganha `cloud` e
-- `chat-attachments`.
--
-- Convenção de path:
--   cloud            {owner_id}/{file_id}/{version}
--   chat-attachments {conversation_id}/{message_id}/{filename}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cloud', 'cloud', false, 26214400,
    array['application/pdf', 'image/jpeg', 'image/png']),
  ('chat-attachments', 'chat-attachments', false, 26214400,
    array['application/pdf', 'image/jpeg', 'image/png']);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.addons enable row level security;
alter table public.subscription_addons enable row level security;
alter table public.folders enable row level security;
alter table public.files enable row level security;
alter table public.file_versions enable row level security;
alter table public.file_shares enable row level security;
alter table public.document_access_log enable row level security;

-- addons: como `plans`, o catálogo é público (a página de preços mostra o
-- extra sem sessão). Escrita só admin.
create policy addons_select_public on public.addons
  for select using (true);

create policy addons_admin_write on public.addons
  for all using (public.is_admin()) with check (public.is_admin());

-- subscription_addons: cada um vê o seu; staff vê todos. A escrita é do
-- webhook do Stripe (Fase 7), por isso fica reservada a admin, tal como
-- `subscriptions` na Fase 2.
create policy subscription_addons_select_own on public.subscription_addons
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.subscriptions s
      where s.id = subscription_id and s.profile_id = auth.uid()
    )
  );

create policy subscription_addons_admin_write on public.subscription_addons
  for all using (public.is_admin()) with check (public.is_admin());

-- folders: a pasta é de quem a tem. As automáticas não se apagam enquanto o
-- imóvel existir (07 §19.1) — o delete só alcança `kind = 'user'`.
create policy folders_select_own on public.folders
  for select using (
    owner_id = auth.uid()
    or (scope = 'staff' and public.is_staff())
  );

create policy folders_insert_own on public.folders
  for insert with check (
    (owner_id = auth.uid() and scope = 'personal' and kind = 'user')
    or (scope = 'staff' and public.is_staff())
  );

create policy folders_update_own on public.folders
  for update using (
    (owner_id = auth.uid() and scope = 'personal')
    or (scope = 'staff' and public.is_staff())
  ) with check (
    (owner_id = auth.uid() and scope = 'personal')
    or (scope = 'staff' and public.is_staff())
  );

create policy folders_delete_own on public.folders
  for delete using (
    (owner_id = auth.uid() and scope = 'personal' and kind = 'user')
    or (scope = 'staff' and public.is_staff())
  );

-- files: vê o dono, quem tem partilha ativa, e o staff no scope staff.
-- Reparar que a partilha dá LEITURA e mais nada: escrever continua a ser só
-- do dono (07 §19.7 — não há permissão de edição numa partilha).
create policy files_select_own_or_shared on public.files
  for select using (
    owner_id = auth.uid()
    or (scope = 'staff' and public.is_staff())
    or exists (
      select 1 from public.file_shares s
      where s.file_id = files.id
        and s.shared_with = auth.uid()
        and s.revoked_at is null
        and (s.expires_at is null or s.expires_at > now())
    )
  );

-- 07 §19.5: um documento de imóvel é só de leitura pelo lado da Cloud.
-- Substituir e apagar fazem-se no formulário do imóvel, onde o aviso de nova
-- moderação de 07 §5.4 já existe — sem isto, apagar um ficheiro na Cloud
-- despublicaria um imóvel `active` sem ninguém perceber porquê.
create policy files_insert_own on public.files
  for insert with check (
    (owner_id = auth.uid() and scope = 'personal' and source <> 'property_document')
    or (scope = 'staff' and public.is_staff())
  );

create policy files_update_own on public.files
  for update using (
    (owner_id = auth.uid() and scope = 'personal' and source <> 'property_document')
    or (scope = 'staff' and public.is_staff())
  ) with check (
    (owner_id = auth.uid() and scope = 'personal' and source <> 'property_document')
    or (scope = 'staff' and public.is_staff())
  );

create policy files_delete_own on public.files
  for delete using (
    (owner_id = auth.uid() and scope = 'personal' and source <> 'property_document')
    or (scope = 'staff' and public.is_staff())
  );

-- file_versions: segue o ficheiro. A escrita é sempre por função
-- `security definer` (substituir cria versão), nunca por insert solto — assim
-- não há caminho que grave uma versão sem atualizar `files.current_version`.
create policy file_versions_select_via_file on public.file_versions
  for select using (
    exists (
      select 1 from public.files f
      where f.id = file_versions.file_id
        and (
          f.owner_id = auth.uid()
          or (f.scope = 'staff' and public.is_staff())
          or exists (
            select 1 from public.file_shares s
            where s.file_id = f.id
              and s.shared_with = auth.uid()
              and s.revoked_at is null
              and (s.expires_at is null or s.expires_at > now())
          )
        )
    )
  );

-- file_shares: quem partilhou gere as suas partilhas; quem recebeu vê a sua
-- (precisa de saber que permissão tem e até quando).
create policy file_shares_select_involved on public.file_shares
  for select using (
    shared_by = auth.uid()
    or shared_with = auth.uid()
    or public.is_staff()
  );

create policy file_shares_owner_write on public.file_shares
  for all using (
    shared_by = auth.uid()
    and exists (
      select 1 from public.files f
      where f.id = file_shares.file_id and f.owner_id = auth.uid()
    )
  ) with check (
    shared_by = auth.uid()
    and exists (
      select 1 from public.files f
      where f.id = file_shares.file_id and f.owner_id = auth.uid()
    )
  );

-- document_access_log — 07 §13.3 e §13.4.
--
-- SELECT: o dono do documento vê o registo do que é seu; o admin vê tudo (e a
-- consulta dele fica, ela própria, no `audit_log`). A CONTRAPARTE NÃO VÊ o
-- registo de acessos (§13.4), e o `support` não vê nada.
--
-- Não há policy de INSERT, UPDATE nem DELETE. É deliberado: a tabela é
-- append-only e só o servidor escreve, pela função da parte 2/3. Uma tabela
-- com RLS ativa e sem policy de escrita recusa toda a escrita do cliente.
create policy document_access_log_select_owner on public.document_access_log
  for select using (
    public.is_admin()
    or (
      subject_type = 'file'
      and exists (
        select 1 from public.files f
        where f.id = document_access_log.subject_id and f.owner_id = auth.uid()
      )
    )
    or (
      subject_type = 'property_document'
      and exists (
        select 1 from public.property_documents d
        join public.properties p on p.id = d.property_id
        where d.id = document_access_log.subject_id and p.owner_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Storage — policies dos buckets novos
--
-- `cloud`: o dono faz tudo no seu prefixo. Quem recebeu uma partilha ativa lê
-- o objeto (a URL assinada é gerada com a sessão de quem a pede, como nas
-- fotos da Fase 4), e o segundo segmento do nome é o file_id.
-- As ligações ANÓNIMAS não passam por aqui — não há sessão para a policy
-- avaliar. Ver a nota em 08 §9 sobre o caminho servidor dessas.
-- ---------------------------------------------------------------------------

create policy cloud_objects_owner on storage.objects
  for all using (
    bucket_id = 'cloud' and (split_part(name, '/', 1))::uuid = auth.uid()
  ) with check (
    bucket_id = 'cloud' and (split_part(name, '/', 1))::uuid = auth.uid()
  );

-- Leitura por partilha, nos dois buckets onde um ficheiro da Cloud pode
-- viver. O emparelhamento é por `storage_path` e não por troços do nome: os
-- dois buckets têm convenções de path diferentes (a de `documents` vem da
-- Fase 4) e uma policy que parte o nome teria de conhecer as duas.
create policy cloud_objects_shared_select on storage.objects
  for select using (
    bucket_id in ('cloud', 'documents')
    and exists (
      select 1
      from public.file_shares s
      join public.files f on f.id = s.file_id
      where f.bucket = storage.objects.bucket_id
        and f.storage_path = storage.objects.name
        and s.shared_with = auth.uid()
        and s.revoked_at is null
        and (s.expires_at is null or s.expires_at > now())
    )
  );

-- `chat-attachments`: lê e escreve quem participa na conversa. O primeiro
-- segmento do nome é o conversation_id (07 §19.6). Fora da quota da Cloud —
-- só entra na quota se o utilizador carregar em "Guardar na Cloud", e aí
-- nasce um `files` normal no bucket `cloud`.
create policy chat_attachments_participants on storage.objects
  for all using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.conversations c
      where c.id = (split_part(name, '/', 1))::uuid
        and auth.uid() in (c.buyer_id, c.owner_id)
    )
  ) with check (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.conversations c
      where c.id = (split_part(name, '/', 1))::uuid
        and auth.uid() in (c.buyer_id, c.owner_id)
    )
  );
