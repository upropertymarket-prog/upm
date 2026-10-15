-- ---------------------------------------------------------------------------
-- A Cloud interna abre ao Marketing (P10-10 · 07 §24.6 · 05 §1.9)
--
-- Esta migração é a que `20261014120100` prometeu, com as duas peças que ela
-- nomeou. Vale a pena citar o que lá ficou escrito, porque é o plano:
--
--   "O caso que 07 §24.6 nomeia para [`is_internal()`] é a Cloud interna, que
--   a tabela da mesma secção põe em `/suporte/cloud` e `/marketing/cloud` como
--   trabalho de P10-10. (…) Há ainda um segundo troço que a Cloud partilhada
--   vai precisar e que não é óbvio: a política `cloud_objects_owner` do bucket
--   `cloud` compara o primeiro segmento do caminho com `auth.uid()`, logo um
--   ficheiro de scope `staff` carregado pelo Suporte **não é legível pelo
--   Marketing** mesmo com a linha de `files` aberta. Isso resolve-se com uma
--   política própria, emparelhada por `storage_path` como já faz
--   `cloud_objects_shared_select` — e resolve-se em P10-10, ao lado do ecrã
--   que a torna verificável. Fica escrito aqui para que em P10-10 ninguém
--   descubra isto a partir de um «transferir» que devolve 403."
--
-- Ninguém descobriu por um 403. As duas peças estão aqui.
--
-- ## O que muda e o que não muda
--
-- Muda **só o troço `scope = 'staff'`** das oito políticas de `folders` e
-- `files`, de `is_staff()` para `is_internal()`. O troço do dono —
-- `owner_id = auth.uid() and scope = 'personal'` — fica intacto, e com ele toda
-- a Cloud do cliente: a Fase 6 não é tocada por esta migração.
--
-- É também a razão de as políticas serem **recriadas uma a uma e por extenso**
-- em vez de alteradas com um `alter policy`: quem ler este ficheiro daqui a um
-- ano vê a expressão completa de cada uma, e não um diff que obriga a ir buscar
-- `20260930120000` para perceber o que ficou. 07 §20.7 proíbe reescrever a
-- migração aplicada; recriar a política numa migração nova é o caminho.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- folders
-- ---------------------------------------------------------------------------

drop policy folders_select_own on public.folders;
create policy folders_select_own on public.folders
  for select using (
    owner_id = auth.uid()
    or (scope = 'staff' and public.is_internal())
  );

drop policy folders_insert_own on public.folders;
create policy folders_insert_own on public.folders
  for insert with check (
    (owner_id = auth.uid() and scope = 'personal' and kind = 'user')
    or (scope = 'staff' and public.is_internal())
  );

drop policy folders_update_own on public.folders;
create policy folders_update_own on public.folders
  for update using (
    (owner_id = auth.uid() and scope = 'personal')
    or (scope = 'staff' and public.is_internal())
  ) with check (
    (owner_id = auth.uid() and scope = 'personal')
    or (scope = 'staff' and public.is_internal())
  );

drop policy folders_delete_own on public.folders;
create policy folders_delete_own on public.folders
  for delete using (
    (owner_id = auth.uid() and scope = 'personal' and kind = 'user')
    or (scope = 'staff' and public.is_internal())
  );

-- ---------------------------------------------------------------------------
-- files
--
-- A cláusula `source <> 'property_document'` fica onde estava, no troço
-- pessoal: 07 §19.5 diz que um documento de imóvel é só de leitura pelo lado da
-- Cloud, e isso não muda por haver mais gente a ver a Cloud interna.
-- ---------------------------------------------------------------------------

drop policy files_select_own_or_shared on public.files;
create policy files_select_own_or_shared on public.files
  for select using (
    owner_id = auth.uid()
    or (scope = 'staff' and public.is_internal())
    or exists (
      select 1 from public.file_shares s
      where s.file_id = files.id
        and s.shared_with = auth.uid()
        and s.revoked_at is null
        and (s.expires_at is null or s.expires_at > now())
    )
  );

-- **Não há política de `insert` em `files`, e não é esquecimento.**
-- `20260930120300` apagou a que existia, com a razão escrita: um insert direto
-- passava ao lado de `cloud_register_upload()` e, com ela, da quota de
-- 07 §19.8. O lado interno tem a sua própria porta — `cloud_register_staff_file()`,
-- que nasceu com D66 e que esta migração abre ao Marketing, mais abaixo.

drop policy files_update_own on public.files;
create policy files_update_own on public.files
  for update using (
    (owner_id = auth.uid() and scope = 'personal' and source <> 'property_document')
    or (scope = 'staff' and public.is_internal())
  ) with check (
    (owner_id = auth.uid() and scope = 'personal' and source <> 'property_document')
    or (scope = 'staff' and public.is_internal())
  );

drop policy files_delete_own on public.files;
create policy files_delete_own on public.files
  for delete using (
    (owner_id = auth.uid() and scope = 'personal' and source <> 'property_document')
    or (scope = 'staff' and public.is_internal())
  );

-- ---------------------------------------------------------------------------
-- O troço que não é óbvio: os **bytes**
--
-- `cloud_objects_owner` dá ao dono tudo no seu prefixo (`{uid}/…`). Para a
-- Cloud pessoal chega, porque o dono é quem lá mexe. Para a Cloud **interna**
-- não chega e falha de uma forma que não se vê na base de dados: a linha de
-- `files` abre-se com as políticas de cima, o ficheiro aparece na lista, e o
-- "transferir" devolve 403 porque o objeto no storage continua a pertencer ao
-- prefixo de quem o carregou.
--
-- A política emparelha por `storage_path`, como `cloud_objects_shared_select`
-- faz para as partilhas, e pela mesma razão que lá está escrita: os buckets têm
-- convenções de caminho diferentes e uma política que parta o nome teria de
-- conhecer as duas.
--
-- **`select` e `delete`, não `insert`.** Ler é o que torna a Cloud partilhada
-- útil; apagar é o que a impede de encher de ficheiros que ninguém pode tirar
-- porque quem os pôs já não está na equipa. Escrever continua pelo prefixo do
-- próprio — quem carrega, carrega em seu nome, e é isso que o registo mostra.
-- ---------------------------------------------------------------------------

create policy cloud_objects_staff_select on storage.objects
  for select using (
    bucket_id in ('cloud', 'documents')
    and public.is_internal()
    and exists (
      select 1 from public.files f
      where f.scope = 'staff'
        and f.bucket = storage.objects.bucket_id
        and f.storage_path = storage.objects.name
    )
  );

create policy cloud_objects_staff_delete on storage.objects
  for delete using (
    bucket_id = 'cloud'
    and public.is_internal()
    and exists (
      select 1 from public.files f
      where f.scope = 'staff'
        and f.bucket = 'cloud'
        and f.storage_path = storage.objects.name
    )
  );

-- ---------------------------------------------------------------------------
-- cloud_register_staff_file — a porta de escrita abre ao Marketing e ganha pasta
--
-- A função nasceu com D66 (os anexos do correio guardados na Cloud) e o
-- comentário dela já dizia "D66/**P10-10**": foi escrita a contar com esta
-- tarefa. Faltavam-lhe duas coisas, e a primeira é a mesma que mordeu nas
-- assinaturas — pela quarta vez nesta fase:
--
-- 1. **`is_staff()` não inclui o Marketing** (07 §24.6). A Cloud interna é da
--    equipa toda, e a mensagem de erro da própria função já dizia "apenas a
--    equipa interna escreve na Cloud interna" — só que `is_staff()` quer dizer
--    `admin | support`, e não "equipa interna". O predicado que quer dizer isso
--    chama-se `is_internal()` e existe desde `20261014120100`. A frase estava
--    certa; o guarda é que não correspondia a ela.
-- 2. **Não aceitava pasta.** Punha tudo em `folder_id = null`, o que serve um
--    anexo guardado à pressa e não serve um relatório que nasce todos os meses.
--
-- `drop` e recriação em vez de `create or replace`: acrescentar um parâmetro
-- muda a assinatura, e um `create or replace` deixava as **duas** funções vivas
-- — a de seis argumentos e a de sete — com o Postgres a escolher por tipos.
-- Os chamadores existentes (os anexos do correio) passam argumentos nomeados e
-- continuam a resolver, agora com `p_folder_id` por omissão nulo.
-- ---------------------------------------------------------------------------

drop function public.cloud_register_staff_file(
  text, text, bigint, text, text, public.file_source
);

create or replace function public.cloud_register_staff_file(
  p_name text,
  p_mime text,
  p_size bigint,
  p_storage_path text,
  p_checksum text,
  p_source public.file_source default 'upload',
  p_folder_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_file_id uuid;
begin
  -- Nos dois lados (07 §20.5): a Server Action já verificou, e esta função tem
  -- de se defender de quem chame o RPC diretamente.
  if not public.is_internal() then
    raise exception 'Apenas a equipa interna escreve na Cloud interna.' using errcode = '42501';
  end if;

  if p_size > 26214400 then
    raise exception 'O ficheiro excede 25 MB' using errcode = '22003';
  end if;

  if p_source = 'property_document' then
    raise exception 'Documentos do imóvel entram pelo formulário do imóvel' using errcode = '42501';
  end if;

  -- A pasta tem de ser da Cloud interna. Sem esta verificação, um `folder_id`
  -- de uma pasta pessoal de outra pessoa punha um ficheiro de equipa dentro da
  -- Cloud privada de alguém — visível para a equipa pela policy de `scope`, e
  -- na lista de quem nunca o pôs lá.
  if p_folder_id is not null and not exists (
    select 1 from public.folders
     where id = p_folder_id and scope = 'staff'
  ) then
    raise exception 'Pasta inválida para a Cloud interna.' using errcode = '42501';
  end if;

  insert into public.files (
    owner_id, folder_id, scope, name, mime, size, bucket, storage_path,
    checksum, source
  ) values (
    v_me, p_folder_id, 'staff', p_name, p_mime, p_size, 'cloud', p_storage_path,
    p_checksum, p_source
  ) returning id into v_file_id;

  insert into public.file_versions (
    file_id, version, bucket, storage_path, name, mime, size, checksum, created_by
  ) values (
    v_file_id, 1, 'cloud', p_storage_path, p_name, p_mime, p_size, p_checksum, v_me
  );

  return v_file_id;
end;
$$;

comment on function public.cloud_register_staff_file(
  text, text, bigint, text, text, public.file_source, uuid
) is
  'D66, completa em P10-10: a única porta de escrita em files pelo lado interno. is_internal() — a Cloud da equipa é da equipa toda — e com pasta.';

revoke all on function public.cloud_register_staff_file(
  text, text, bigint, text, text, public.file_source, uuid
) from public, anon;
grant execute on function public.cloud_register_staff_file(
  text, text, bigint, text, text, public.file_source, uuid
) to authenticated;

-- ---------------------------------------------------------------------------
-- staff_cloud_folder — a pasta de uma secção da equipa, criada à chegada
--
-- A Cloud interna precisa de um sítio previsível para o que o produto lá põe
-- sozinho — os relatórios das campanhas, em P10-10. Sem isto, a primeira
-- exportação tinha de escolher uma pasta e escolhia a raiz, e a Cloud da equipa
-- começava a vida como uma gaveta de ficheiros soltos.
--
-- `security definer` porque cria a pasta na primeira vez que alguém a pede, e
-- `owner_id` é quem pediu: no scope `staff` o dono é o registo de quem criou,
-- não um dono que restringe — as políticas de cima já não olham para ele.
-- ---------------------------------------------------------------------------

create or replace function public.staff_cloud_folder(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not public.is_internal() then
    raise exception 'A Cloud interna é da equipa.' using errcode = '42501';
  end if;
  if length(v_name) = 0 then
    raise exception 'A pasta precisa de um nome.' using errcode = '22023';
  end if;

  select id into v_id
    from public.folders
   where scope = 'staff' and parent_id is null and lower(name) = lower(v_name)
   limit 1;

  if v_id is not null then return v_id; end if;

  insert into public.folders (owner_id, name, kind, scope)
  values (auth.uid(), v_name, 'user', 'staff')
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.staff_cloud_folder(text) is
  'P10-10: devolve (criando à primeira) uma pasta de topo da Cloud interna. É onde os relatórios de campanha aterram, para não nascerem na raiz.';

revoke all on function public.staff_cloud_folder(text) from public, anon;
grant execute on function public.staff_cloud_folder(text) to authenticated;
