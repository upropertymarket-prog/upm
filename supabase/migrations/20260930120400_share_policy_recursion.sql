-- UProperty Market — Fase 6, correção às partes 1/3 e 3/3
--
-- Bug: `infinite recursion detected in policy for relation "file_shares"`
-- (42P17). Apanhado pelos testes de storage da Fase 4, que passaram a falhar
-- com "The database schema is invalid or incompatible" — o erro do Postgres
-- chega ao storage-api como 503 e esconde a causa.
--
-- Como se fecha o ciclo: `file_shares_owner_write` foi criada `for all`, e
-- `for all` INCLUI select. Essa policy consulta `files`; a policy de leitura
-- de `files` consulta `file_shares`; e voltamos ao princípio. O mesmo par
-- existia entre `contract_shares_owner_write` e `contracts`.
--
-- Correção: a leitura destas duas tabelas fica só com a policy que já existe
-- e que não sai da própria tabela (`*_select_involved`); a escrita passa a
-- três policies explícitas de insert/update/delete. Nenhuma delas corre em
-- select, por isso o ciclo desaparece.
--
-- Lição para as tabelas seguintes: `for all` numa tabela que outra policy já
-- consulta é um ciclo à espera de acontecer. Quando duas tabelas se
-- referenciam nas policies, pelo menos um dos lados tem de ler-se sozinho.

drop policy file_shares_owner_write on public.file_shares;

create policy file_shares_owner_insert on public.file_shares
  for insert with check (
    shared_by = auth.uid()
    and exists (
      select 1 from public.files f
      where f.id = file_shares.file_id and f.owner_id = auth.uid()
    )
  );

create policy file_shares_owner_update on public.file_shares
  for update using (
    shared_by = auth.uid()
    and exists (
      select 1 from public.files f
      where f.id = file_shares.file_id and f.owner_id = auth.uid()
    )
  ) with check (shared_by = auth.uid());

create policy file_shares_owner_delete on public.file_shares
  for delete using (
    shared_by = auth.uid()
    and exists (
      select 1 from public.files f
      where f.id = file_shares.file_id and f.owner_id = auth.uid()
    )
  );

drop policy contract_shares_owner_write on public.contract_shares;

create policy contract_shares_owner_insert on public.contract_shares
  for insert with check (
    shared_by = auth.uid()
    and exists (
      select 1 from public.contracts c
      where c.id = contract_shares.contract_id and c.owner_id = auth.uid()
    )
  );

create policy contract_shares_owner_update on public.contract_shares
  for update using (
    shared_by = auth.uid()
    and exists (
      select 1 from public.contracts c
      where c.id = contract_shares.contract_id and c.owner_id = auth.uid()
    )
  ) with check (shared_by = auth.uid());

create policy contract_shares_owner_delete on public.contract_shares
  for delete using (
    shared_by = auth.uid()
    and exists (
      select 1 from public.contracts c
      where c.id = contract_shares.contract_id and c.owner_id = auth.uid()
    )
  );

-- `ensure_property_folders` é `security definer` e recebe o perfil por
-- argumento: sem guarda, qualquer sessão podia criar pastas na conta de
-- outra pessoa. Não vaza nada, mas escreve onde não devia.
--
-- `auth.uid()` nulo é o cron e o `service_role` (o webhook do Stripe de
-- P7-03); o admin entra por causa da moderação, que muda o estado de um
-- imóvel de outra pessoa e faz correr o trigger.
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
  if auth.uid() is not null and auth.uid() <> p_profile_id and not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

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
