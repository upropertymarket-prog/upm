-- UProperty Market — migração da Fase 6 (Cloud e contratos), parte 2/3
--
-- Quota, pastas automáticas, versões, partilhas, registo de acessos e as
-- leituras da Cloud. Referências: 07 §13 (histórico e rastreabilidade),
-- 07 §19.1–§19.8 (decisões desta fase).
--
-- Padrão herdado da Fase 5 e mantido aqui: as transições e os invariantes
-- vivem em funções `security definer` com `set search_path`, chamadas pelas
-- Server Actions — nunca em UPDATEs soltos da aplicação. E as listas que
-- precisam de cruzar tabelas para mostrar o nome de outra pessoa devolvem só
-- as colunas que o contexto já implica, em vez de alargar policies.

-- ---------------------------------------------------------------------------
-- Quota — 07 §19.2, §19.3 e §19.8
--
-- `cloud_usage_bytes` conta TODAS as versões (§19.8 #3) e continua a contar o
-- que está na reciclagem (§19.8 #4). Não conta documentos do imóvel
-- (§19.8 #5): existem desde a Fase 4, são obrigatórios para a moderação, e um
-- Gratuito tem-nos com 0 GB de Cloud.
-- ---------------------------------------------------------------------------

create or replace function public.cloud_usage_bytes(p_profile_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(v.size), 0)::bigint
  from public.file_versions v
  join public.files f on f.id = v.file_id
  where f.owner_id = p_profile_id
    and f.scope = 'personal'
    and f.source <> 'property_document';
$$;

-- null = ilimitado (07 §19.2). 0 = sem Cloud (Gratuito, 07 §19.1).
create or replace function public.cloud_limit_bytes(p_profile_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.effective_limits(p_profile_id) -> 'cloud_gb' is null then null
    when jsonb_typeof(public.effective_limits(p_profile_id) -> 'cloud_gb') <> 'number' then null
    else ((public.effective_limits(p_profile_id) ->> 'cloud_gb')::numeric * 1073741824)::bigint
  end;
$$;

-- ---------------------------------------------------------------------------
-- cloud_status — o que o ecrã /cloud precisa de saber antes de desenhar
-- fosse o que fosse, incluindo qual dos dois convites de 07 §19.4 mostrar.
--
-- `near_plan_limit`: qualquer outro limite do plano a 80 % ou mais. Quem está
-- nessa situação não tem um problema de Cloud, tem um problema de plano — e a
-- app não lhe deve empurrar o extra.
-- ---------------------------------------------------------------------------

create or replace function public.cloud_status()
returns table (
  has_cloud boolean,
  used_bytes bigint,
  limit_bytes bigint,
  near_plan_limit boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_limits jsonb;
  v_limit_bytes bigint;
  v_near boolean := false;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  v_limits := public.effective_limits(v_me);
  v_limit_bytes := public.cloud_limit_bytes(v_me);

  -- 80 % em qualquer um dos outros limites. Uma chave a null é ilimitada e
  -- nunca aproxima ninguém de limite nenhum.
  v_near :=
    public.at_limit_ratio(
      (select count(*) from public.properties
        where owner_id = v_me and status in ('active', 'featured')),
      v_limits -> 'active_properties')
    or public.at_limit_ratio(
      (select count(*) from public.conversations where v_me in (buyer_id, owner_id)),
      v_limits -> 'active_chats')
    or public.at_limit_ratio(
      (select count(*) from public.saved_properties where user_id = v_me),
      v_limits -> 'saved')
    or public.at_limit_ratio(
      (select count(*) from public.search_alerts where user_id = v_me),
      v_limits -> 'alerts');

  return query select
    coalesce(v_limit_bytes is null or v_limit_bytes > 0, false),
    public.cloud_usage_bytes(v_me),
    v_limit_bytes,
    v_near;
end;
$$;

-- Auxiliar do cálculo acima: "este contador está a 80 % ou mais deste limite?"
-- Limite nulo (ilimitado) ou não numérico responde sempre não.
create or replace function public.at_limit_ratio(p_used bigint, p_limit jsonb)
returns boolean
language sql
immutable
as $$
  select case
    when p_limit is null or jsonb_typeof(p_limit) <> 'number' then false
    when (p_limit #>> '{}')::numeric <= 0 then false
    else p_used::numeric / (p_limit #>> '{}')::numeric >= 0.8
  end;
$$;

-- ---------------------------------------------------------------------------
-- ensure_property_folders — 07 §19.1 e §19.5
--
-- Cria a pasta de cada imóvel publicado e, lá dentro, a subpasta
-- "Documentos do imóvel" com os documentos que a Fase 4 já tinha carregado.
-- Idempotente: os dois índices únicos de `folders` garantem-no, e o
-- espelhamento só toca em documentos ainda sem `file_id`.
--
-- Chamada em dois momentos: ao publicar um imóvel (trigger abaixo) e ao ganhar
-- Cloud — subida de plano ou extra de §19.3 —, e aí faz de uma vez as pastas
-- de todas as propriedades que já existem. Essa segunda chamada é do webhook
-- do Stripe, em P7-03.
--
-- Não faz nada a quem não tem Cloud no plano: sem isto, um Gratuito ficaria
-- com pastas vazias que não pode usar, que é pior do que não ter pasta
-- nenhuma.
-- ---------------------------------------------------------------------------

create or replace function public.ensure_property_folders(p_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit bigint := public.cloud_limit_bytes(p_profile_id);
  v_property record;
  v_doc record;
  v_folder_id uuid;
  v_docs_folder_id uuid;
  v_file_id uuid;
  v_created integer := 0;
begin
  if v_limit is not null and v_limit <= 0 then
    return 0;  -- sem Cloud no plano (07 §19.1)
  end if;

  for v_property in
    select id, coalesce(nullif(btrim(title), ''), ref) as label
    from public.properties
    where owner_id = p_profile_id and status <> 'draft'
  loop
    insert into public.folders (owner_id, name, kind, property_id)
    values (p_profile_id, v_property.label, 'property', v_property.id)
    on conflict do nothing;

    select id into v_folder_id
    from public.folders
    where owner_id = p_profile_id and property_id = v_property.id and kind = 'property';

    insert into public.folders (owner_id, parent_id, name, kind, property_id)
    values (p_profile_id, v_folder_id, 'Documentos do imóvel', 'property_documents', v_property.id)
    on conflict do nothing;

    select id into v_docs_folder_id
    from public.folders
    where parent_id = v_folder_id and kind = 'property_documents';

    -- Reconciliação prevista em 07 §17.1: o documento passa a ter também uma
    -- entrada em `files`, apontada ao MESMO objeto de storage. Não é cópia —
    -- duplicar o ficheiro daria duas verdades para o mesmo documento.
    for v_doc in
      select d.id, d.storage_path, d.name, d.mime, d.size, d.kind
      from public.property_documents d
      where d.property_id = v_property.id and d.file_id is null
    loop
      insert into public.files (
        owner_id, folder_id, name, mime, size, bucket, storage_path,
        checksum, property_id, kind, source
      ) values (
        p_profile_id, v_docs_folder_id, v_doc.name, v_doc.mime, v_doc.size,
        'documents', v_doc.storage_path,
        -- Sem checksum: o ficheiro entrou na Fase 4, antes de 07 §13.1 existir.
        -- Fica vazio em vez de inventar um — e é o que distingue, mais tarde,
        -- um documento herdado de um verificado.
        '', v_property.id, v_doc.kind, 'property_document'
      ) returning id into v_file_id;

      insert into public.file_versions (
        file_id, version, bucket, storage_path, name, mime, size, checksum, created_by, note
      ) values (
        v_file_id, 1, 'documents', v_doc.storage_path, v_doc.name, v_doc.mime,
        v_doc.size, '', p_profile_id, 'Documento carregado antes da Cloud existir'
      );

      update public.property_documents set file_id = v_file_id where id = v_doc.id;
      v_created := v_created + 1;
    end loop;
  end loop;

  return v_created;
end;
$$;

-- Publicar um imóvel cria a pasta na mesma transação (07 §19.1).
create or replace function public.property_folder_on_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'draft' and (tg_op = 'INSERT' or old.status = 'draft') then
    perform public.ensure_property_folders(new.owner_id);
  end if;
  return new;
end;
$$;

create trigger properties_ensure_cloud_folder
  after insert or update of status on public.properties
  for each row execute function public.property_folder_on_publish();

-- ---------------------------------------------------------------------------
-- Registo de acessos — 07 §13.3
--
-- Escrito ANTES de a URL assinada ser emitida: se o download falhar a meio, o
-- pedido fica registado na mesma. Mais vale um falso positivo do que um
-- acesso invisível.
--
-- É a única porta de escrita da tabela — `document_access_log` não tem policy
-- de insert, por isso nem o dono lá escreve diretamente. `p_share_id` não
-- nulo com `actor` nulo é o caso da ligação anónima (§13.3).
-- ---------------------------------------------------------------------------

create or replace function public.log_document_access(
  p_subject_type public.document_subject,
  p_subject_id uuid,
  p_action public.document_action,
  p_version_id uuid default null,
  p_share_id uuid default null,
  p_ip inet default null,
  p_user_agent text default null,
  p_bytes_sent bigint default null
)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into public.document_access_log (
    subject_type, subject_id, action, version_id, share_id,
    actor_profile_id, ip, user_agent, bytes_sent
  ) values (
    p_subject_type, p_subject_id, p_action, p_version_id, p_share_id,
    auth.uid(), p_ip, p_user_agent, p_bytes_sent
  )
  returning id;
$$;

grant execute on function public.log_document_access(
  public.document_subject, uuid, public.document_action, uuid, uuid, inet, text, bigint
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Upload e substituição
--
-- `cloud_register_upload` corre DEPOIS de o objeto estar no storage e ANTES de
-- ele contar como ficheiro: se a quota não chega, recusa e a Server Action
-- apaga o objeto. A alternativa — verificar antes — não fecha a janela entre
-- a verificação e a escrita.
-- ---------------------------------------------------------------------------

create or replace function public.cloud_register_upload(
  p_folder_id uuid,
  p_name text,
  p_mime text,
  p_size bigint,
  p_storage_path text,
  p_checksum text,
  p_property_id uuid default null,
  p_source public.file_source default 'upload'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_limit bigint;
  v_used bigint;
  v_file_id uuid;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if p_source = 'property_document' then
    raise exception 'Documentos do imóvel entram pelo formulário do imóvel' using errcode = '42501';
  end if;
  if p_size > 26214400 then
    raise exception 'O ficheiro excede 25 MB' using errcode = '22003';
  end if;
  if p_folder_id is not null and not exists (
    select 1 from public.folders
    where id = p_folder_id and owner_id = v_me and kind <> 'property_documents'
  ) then
    -- A subpasta de documentos do imóvel é só de leitura (07 §19.5).
    raise exception 'Pasta inválida' using errcode = '42501';
  end if;

  v_limit := public.cloud_limit_bytes(v_me);
  v_used := public.cloud_usage_bytes(v_me);

  if v_limit is not null and v_limit <= 0 then
    raise exception 'O seu plano não inclui Cloud' using errcode = '53100';
  end if;
  if v_limit is not null and v_used + p_size > v_limit then
    raise exception 'Sem espaço disponível na Cloud' using errcode = '53100';
  end if;

  insert into public.files (
    owner_id, folder_id, name, mime, size, bucket, storage_path,
    checksum, property_id, source
  ) values (
    v_me, p_folder_id, p_name, p_mime, p_size, 'cloud', p_storage_path,
    p_checksum, p_property_id, p_source
  ) returning id into v_file_id;

  insert into public.file_versions (
    file_id, version, bucket, storage_path, name, mime, size, checksum, created_by
  ) values (
    v_file_id, 1, 'cloud', p_storage_path, p_name, p_mime, p_size, p_checksum, v_me
  );

  return v_file_id;
end;
$$;

-- 07 §13.1: substituir NUNCA sobrescreve. A versão anterior fica acessível, e
-- conta para a quota (07 §19.8 #3) — sem isso, "substituir" era armazenamento
-- infinito.
create or replace function public.cloud_add_file_version(
  p_file_id uuid,
  p_name text,
  p_mime text,
  p_size bigint,
  p_storage_path text,
  p_checksum text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_file public.files;
  v_limit bigint;
  v_used bigint;
  v_next integer;
begin
  select * into v_file from public.files where id = p_file_id;
  if v_file.id is null then
    raise exception 'Ficheiro inexistente' using errcode = 'P0002';
  end if;
  if v_file.owner_id <> v_me then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v_file.source = 'property_document' then
    raise exception 'Este documento substitui-se no formulário do imóvel' using errcode = '42501';
  end if;
  if p_size > 26214400 then
    raise exception 'O ficheiro excede 25 MB' using errcode = '22003';
  end if;

  v_limit := public.cloud_limit_bytes(v_me);
  v_used := public.cloud_usage_bytes(v_me);
  if v_limit is not null and v_used + p_size > v_limit then
    raise exception 'Sem espaço disponível na Cloud' using errcode = '53100';
  end if;

  v_next := v_file.current_version + 1;

  insert into public.file_versions (
    file_id, version, bucket, storage_path, name, mime, size, checksum, created_by, note
  ) values (
    p_file_id, v_next, 'cloud', p_storage_path, p_name, p_mime, p_size,
    p_checksum, v_me, p_note
  );

  update public.files set
    current_version = v_next,
    name = p_name,
    mime = p_mime,
    size = p_size,
    bucket = 'cloud',
    storage_path = p_storage_path,
    checksum = p_checksum
  where id = p_file_id;

  return v_next;
end;
$$;

-- Restaurar uma versão antiga CRIA UMA VERSÃO NOVA com o conteúdo antigo
-- (07 §13.1): o histórico nunca perde linhas. O objeto de storage é o mesmo,
-- por isso o tamanho conta uma vez só.
create or replace function public.cloud_restore_file_version(p_file_id uuid, p_version integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_old public.file_versions;
  v_current integer;
  v_next integer;
begin
  if not exists (select 1 from public.files where id = p_file_id and owner_id = v_me) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  select * into v_old from public.file_versions
  where file_id = p_file_id and version = p_version;
  if v_old.id is null then
    raise exception 'Versão inexistente' using errcode = 'P0002';
  end if;

  select current_version into v_current from public.files where id = p_file_id;
  v_next := v_current + 1;

  insert into public.file_versions (
    file_id, version, bucket, storage_path, name, mime, size, checksum, created_by, note
  ) values (
    p_file_id, v_next, v_old.bucket, v_old.storage_path, v_old.name, v_old.mime,
    v_old.size, v_old.checksum, v_me, format('Restauro da versão %s', p_version)
  );

  update public.files set
    current_version = v_next,
    name = v_old.name,
    mime = v_old.mime,
    size = v_old.size,
    bucket = v_old.bucket,
    storage_path = v_old.storage_path,
    checksum = v_old.checksum
  where id = p_file_id;

  return v_next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reciclagem — 07 §13.1 (soft delete) e §19.8 #4
--
-- O eliminado continua a contar para a quota até à purga, para o ciclo
-- apagar/recarregar não esconder o consumo. "Esvaziar reciclagem" antecipa-a.
-- ---------------------------------------------------------------------------

create or replace function public.cloud_delete_file(p_file_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_source public.file_source;
begin
  select source into v_source from public.files where id = p_file_id and owner_id = v_me;
  if v_source is null then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v_source = 'property_document' then
    raise exception 'Este documento elimina-se no formulário do imóvel' using errcode = '42501';
  end if;

  update public.files
  set deleted_at = now(), purge_after = now() + interval '30 days'
  where id = p_file_id;
end;
$$;

create or replace function public.cloud_empty_recycle_bin()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_count integer;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  update public.files set purge_after = now()
  where owner_id = v_me and deleted_at is not null and purge_after > now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Partilhas — P6-02, 03 F7, 07 §19.7 e §19.11
--
-- `share_created` e `share_revoked` entram no registo de acessos (§13.3): quem
-- abriu a porta a quem, e quando, faz parte da prova tanto como o download.
-- ---------------------------------------------------------------------------

create or replace function public.share_file(
  p_file_id uuid,
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
  v_share_id uuid;
begin
  if not exists (select 1 from public.files where id = p_file_id and owner_id = v_me) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if (p_shared_with is null) = (p_token is null) then
    raise exception 'Uma partilha é para uma pessoa OU por ligação' using errcode = '22023';
  end if;
  if p_shared_with = v_me then
    raise exception 'Não pode partilhar consigo próprio' using errcode = '22023';
  end if;

  insert into public.file_shares (
    file_id, shared_by, shared_with, token, permission, expires_at, access_code_hash
  ) values (
    p_file_id, v_me, p_shared_with, p_token, p_permission, p_expires_at, p_access_code_hash
  )
  on conflict (file_id, shared_with) where shared_with is not null and revoked_at is null
  do update set permission = excluded.permission, expires_at = excluded.expires_at
  returning id into v_share_id;

  perform public.log_document_access('file', p_file_id, 'share_created', null, v_share_id);
  return v_share_id;
end;
$$;

create or replace function public.revoke_file_share(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_file_id uuid;
begin
  select s.file_id into v_file_id
  from public.file_shares s
  join public.files f on f.id = s.file_id
  where s.id = p_share_id and f.owner_id = v_me;

  if v_file_id is null then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  update public.file_shares set revoked_at = now()
  where id = p_share_id and revoked_at is null;

  perform public.log_document_access('file', v_file_id, 'share_revoked', null, p_share_id);
end;
$$;

-- Ligação anónima: valida o token e, se houver, o código de acesso. Chamável
-- por `anon` — é o único caminho de leitura de uma partilha sem sessão.
--
-- O limite de tentativas não estava no protótipo e é decisão de 07 §19.8: um
-- código de 4–6 dígitos sem limite adivinha-se numa tarde. Reusa o
-- `auth_attempts` da Fase 3, com um `kind` próprio.
create or replace function public.resolve_file_share(p_token text, p_access_code_hash text default null)
returns table (
  share_id uuid,
  file_id uuid,
  file_name text,
  mime text,
  size bigint,
  permission public.share_permission,
  needs_code boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.file_shares;
  v_limit jsonb;
begin
  v_limit := public.check_auth_rate_limit(p_token, 'share_code');
  if not (v_limit ->> 'allowed')::boolean then
    raise exception 'Demasiadas tentativas. Tente novamente mais tarde.' using errcode = '53400';
  end if;

  select * into v_share from public.file_shares
  where token = p_token
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  if v_share.id is null then
    perform public.record_auth_attempt(p_token, 'share_code', false);
    raise exception 'Ligação inválida ou expirada' using errcode = 'P0002';
  end if;

  if v_share.access_code_hash is not null then
    if p_access_code_hash is null then
      -- Ainda não pediu código: não é tentativa falhada, é o primeiro ecrã.
      return query select v_share.id, v_share.file_id, null::text, null::text,
        null::bigint, v_share.permission, true;
      return;
    end if;
    if p_access_code_hash <> v_share.access_code_hash then
      perform public.record_auth_attempt(p_token, 'share_code', false);
      raise exception 'Código incorreto' using errcode = '42501';
    end if;
  end if;

  perform public.record_auth_attempt(p_token, 'share_code', true);

  return query
    select v_share.id, f.id, f.name, f.mime, f.size, v_share.permission, false
    from public.files f
    where f.id = v_share.file_id and f.deleted_at is null;
end;
$$;

grant execute on function public.resolve_file_share(text, text) to anon, authenticated;

-- `auth_attempts.kind` ganha o valor da partilha (Fase 3 não o previa).
alter table public.auth_attempts drop constraint auth_attempts_kind_check;
alter table public.auth_attempts add constraint auth_attempts_kind_check check (
  kind in (
    'login', 'register', 'password_recovery', 'resend_verification',
    'totp_challenge', 'pin_verify', 'share_code'
  )
);

-- ---------------------------------------------------------------------------
-- Leituras da Cloud
--
-- Mesmo problema da Fase 5: a coluna "Partilha" do protótipo diz "Com João
-- Costa", e a RLS de `profiles` não deixa um utilizador ler o nome de outro.
-- A saída continua a não ser alargar a policy — é devolver por função apenas o
-- nome de quem já está numa partilha do próprio ficheiro.
-- ---------------------------------------------------------------------------

create or replace function public.my_cloud_folders()
returns table (
  id uuid,
  parent_id uuid,
  name text,
  kind public.folder_kind,
  property_id uuid,
  file_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id, d.parent_id, d.name, d.kind, d.property_id,
    (select count(*) from public.files f
      where f.folder_id = d.id and f.deleted_at is null)::integer
  from public.folders d
  where d.owner_id = auth.uid() and d.scope = 'personal'
  order by d.kind, d.name;
$$;

create or replace function public.my_cloud_files(p_folder_id uuid default null)
returns table (
  id uuid,
  folder_id uuid,
  name text,
  mime text,
  size bigint,
  kind text,
  source public.file_source,
  current_version integer,
  readonly boolean,
  shared_label text,
  share_count integer,
  has_link boolean,
  created_at timestamptz,
  deleted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.id, f.folder_id, f.name, f.mime, f.size, f.kind, f.source, f.current_version,
    -- 07 §19.5: o documento do imóvel vê-se e partilha-se, mas não se mexe
    -- daqui — substituir e apagar são do formulário do imóvel.
    f.source = 'property_document',
    -- "Só para si" / "Com João Costa" / "Com 2 pessoas" — a coluna Partilha do
    -- protótipo. O nome só sai quando há exatamente uma pessoa, que é o único
    -- caso em que cabe na coluna.
    coalesce(
      (select case
        when count(*) = 0 then null
        when count(*) = 1 then 'Com ' || max(coalesce(nullif(pr.full_name, ''), 'Utilizador'))
        else format('Com %s pessoas', count(*))
      end
      from public.file_shares s
      join public.profiles pr on pr.id = s.shared_with
      where s.file_id = f.id and s.shared_with is not null
        and s.revoked_at is null
        and (s.expires_at is null or s.expires_at > now())),
      'Só para si'
    ),
    (select count(*) from public.file_shares s
      where s.file_id = f.id and s.revoked_at is null
        and (s.expires_at is null or s.expires_at > now()))::integer,
    exists (select 1 from public.file_shares s
      where s.file_id = f.id and s.token is not null and s.revoked_at is null
        and (s.expires_at is null or s.expires_at > now())),
    f.created_at,
    f.deleted_at
  from public.files f
  where f.owner_id = auth.uid()
    and f.scope = 'personal'
    and (p_folder_id is null or f.folder_id = p_folder_id)
  order by f.deleted_at nulls first, f.created_at desc;
$$;

-- Os ficheiros que OUTROS partilharam comigo — 05 §6.4 ("documento partilhado
-- com um comprador aparece na Cloud do comprador"). Lista separada da de cima
-- de propósito: são de outra pessoa, e o que se pode fazer com eles é outro.
create or replace function public.shared_with_me()
returns table (
  file_id uuid,
  share_id uuid,
  name text,
  mime text,
  size bigint,
  permission public.share_permission,
  shared_by_name text,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.id, s.id, f.name, f.mime, f.size, s.permission,
    coalesce(nullif(owner.full_name, ''), 'Utilizador'),
    s.expires_at, s.created_at
  from public.file_shares s
  join public.files f on f.id = s.file_id
  join public.profiles owner on owner.id = s.shared_by
  where s.shared_with = auth.uid()
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now())
    and f.deleted_at is null
  order by s.created_at desc;
$$;

-- O separador "Acessos" de 07 §13.5, para o dono do ficheiro.
create or replace function public.file_access_log(p_file_id uuid)
returns table (
  occurred_at timestamptz,
  action public.document_action,
  actor_name text,
  via_link boolean,
  ip inet
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.occurred_at, l.action,
    coalesce(nullif(pr.full_name, ''), case when l.share_id is not null then 'Ligação' else 'Utilizador' end),
    l.actor_profile_id is null and l.share_id is not null,
    l.ip
  from public.document_access_log l
  left join public.profiles pr on pr.id = l.actor_profile_id
  where l.subject_type = 'file'
    and l.subject_id = p_file_id
    and exists (
      select 1 from public.files f
      where f.id = p_file_id and (f.owner_id = auth.uid() or public.is_admin())
    )
  order by l.occurred_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Purgas — 07 §13.6 e §19.8 #4
--
-- A regra escrita na migração, não à mão. O registo de acessos guarda-se 2
-- anos (§13.6: NÃO são os 90 dias de logs técnicos de 02 §7.3 — isto é prova
-- de acesso a documento com valor legal). A reciclagem esvazia-se aos 30 dias.
--
-- `purge_cloud_recycle_bin` apaga a linha; o objeto de storage é apagado pelo
-- mesmo job do lado da aplicação, que lê o que saiu daqui.
-- ---------------------------------------------------------------------------

create or replace function public.purge_document_access_log()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.document_access_log where occurred_at < now() - interval '2 years';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.purge_cloud_recycle_bin()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.files
  where deleted_at is not null and purge_after is not null and purge_after <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.schedule(
      'upm-purge-document-access-log', '30 3 * * *',
      'select public.purge_document_access_log()'
    );
    perform cron.schedule(
      'upm-purge-cloud-recycle-bin', '45 3 * * *',
      'select public.purge_cloud_recycle_bin()'
    );
  end if;
end;
$$;
