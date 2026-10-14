-- ---------------------------------------------------------------------------
-- Os bytes dos anexos do correio (D66 · P10-06)
--
-- Até aqui, `mail_messages.attachments` guardava o **cartão de visita** do
-- anexo — nome, tipo e tamanho — e os bytes ficavam no servidor da Amen. As
-- três ações do leitor (Transferir, Imprimir, Guardar na Cloud) estavam no
-- ecrã, desativadas, porque as três precisam do conteúdo. Esta migração dá-lhe
-- o sítio onde morar e a porta por onde sai.
--
-- ## Quatro decisões do cliente, de 14 out 2026
--
-- 1. **A lista é de escritório, não de capturas de ecrã.** D66 pedia "a mesma
--    validação que `ticket-screenshots`", e o que se herda é o mecanismo —
--    bucket privado, lista fechada de MIME, limite de tamanho, verificação nos
--    dois lados. A lista é outra: `ticket-screenshots` aceita três formatos de
--    imagem e recusaria o PDF, que é a maioria do que um cliente anexa.
-- 2. **10 MB por ficheiro, 25 MB e 10 ficheiros por mensagem.** Os dois tetos
--    por mensagem vivem no worker (não há onde os declarar num bucket); o de
--    ficheiro vive aqui **e** lá.
-- 3. **Os bytes expiram aos 180 dias**, por `app_settings`, no molde de
--    `ticket_technical_retention_days`. O metadado fica para sempre: o que
--    desaparece é o conteúdo, não o registo de que houve um anexo. O que
--    importa guardar vai para a Cloud por decisão de quem o leu.
-- 4. **O bucket `cloud` passa a aceitar a mesma lista.** Sem isso, "Guardar na
--    Cloud" ficava desativado num `.docx` — um botão desativado a explicar uma
--    incompatibilidade entre dois buckets nossos. Ver a nota ao fundo: a lista
--    alarga para toda a Cloud, e isso é deliberado.
--
-- ## Porque é que a purga não é `pg_cron`, ao contrário dos tickets
--
-- `purge_ticket_technical_data()` anula colunas, e isso o Postgres faz sozinho.
-- Apagar um objeto de Storage **não é** apagar uma linha de `storage.objects`:
-- a linha sai e os bytes ficam no backend, órfãos e invisíveis. Quem apaga a
-- sério é a API de Storage, e quem a alcança com `service_role` é o
-- `mail-worker` (02 §3.3). Por isso o que vive aqui são as duas metades que o
-- Postgres pode garantir — **que** expirou e **registar** que saiu — e o ciclo
-- é do worker, ao lado da sincronização e da fila de saída.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- O bucket — privado, 10 MB, lista fechada
--
-- Convenção de path: `{mailbox_id}/{message_id}/{índice}-{nome}`. O primeiro
-- segmento é a caixa, como em `ticket-screenshots` o primeiro é o dono — é o
-- que uma policy lê sem abrir o jsonb.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mail-attachments', 'mail-attachments', false, 10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]
)
on conflict (id) do nothing;

-- Lê quem lê o correio — `is_staff()`, nunca o marketing (07 §24.6). Escrever
-- é da `service_role`, que não passa pela RLS: é o mesmo desenho de
-- `mail_messages`, e pela mesma razão. Um anexo é um ficheiro que um estranho
-- nos mandou; a aplicação não tem nenhum caminho para lhe pôr outro por cima.
create policy mail_attachments_staff_select on storage.objects
  for select to authenticated
  using (bucket_id = 'mail-attachments' and public.is_staff());

-- ---------------------------------------------------------------------------
-- O bucket `cloud` aceita a mesma lista
--
-- Decisão do cliente de 14 out 2026. Vale a pena dizer o que isto custa: o
-- bucket `cloud` é o **mesmo** da Cloud dos clientes, logo a lista alarga para
-- todos — um utilizador passa a poder carregar um `.docx` na sua Cloud. Foi
-- aceite de propósito, e a alternativa (um `cloud-staff` à parte) obrigava a
-- abrir um valor novo em `files.bucket` e a mexer nas policies da Fase 6, que é
-- trabalho de P10-10 e não de D66.
--
-- `sniffMime()` em `packages/db/src/cloud.ts` continua a aceitar três tipos, e
-- por isso o upload pela Cloud do utilizador **não muda hoje**: a lista do
-- bucket é a rede de segurança, não a porta. Patch proposto a 07 §19.8 #2 no
-- fim da fase.
-- ---------------------------------------------------------------------------

update storage.buckets
   set allowed_mime_types = array[
     'application/pdf',
     'image/jpeg',
     'image/png',
     'image/webp',
     'image/gif',
     'text/plain',
     'text/csv',
     'application/msword',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-excel',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'application/zip'
   ]
 where id = 'cloud';

-- ---------------------------------------------------------------------------
-- `mail_attachment` — a origem nova de um ficheiro da Cloud
--
-- `message_attachment` já existe e é o anexo do **chat** (07 §19.6). Reutilizá-lo
-- faria os relatórios da Cloud interna de P10-10 contar as duas coisas na mesma
-- linha, e são duas conversas diferentes com duas pessoas diferentes.
-- ---------------------------------------------------------------------------

alter type public.file_source add value if not exists 'mail_attachment';

-- ---------------------------------------------------------------------------
-- Reteção — 180 dias, editável onde as outras se editam
-- ---------------------------------------------------------------------------

insert into public.app_settings (key, value, public, description)
values (
  'mail_attachment_retention_days', '180', false,
  'Dias que os bytes de um anexo de e-mail ficam no bucket mail-attachments. O metadado do anexo fica sempre (D66).'
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- cloud_register_staff_file — "Guardar na Cloud", do lado interno
--
-- Não é `cloud_register_upload` com outro argumento, e a diferença é de fundo:
-- aquela cobra o ficheiro à **quota do plano de quem o carrega** (07 §19.8 #1),
-- e um anexo de suporte não é consumo pessoal de quem está de turno — é arquivo
-- da empresa. Daí `scope = 'staff'`, que existe desde a Fase 6 à espera disto,
-- e nenhuma verificação de quota: a Cloud interna não é uma funcionalidade de
-- plano.
--
-- O limite de tamanho fica, porque o bucket é o mesmo e 25 MB é o seu teto.
-- ---------------------------------------------------------------------------

create or replace function public.cloud_register_staff_file(
  p_name text,
  p_mime text,
  p_size bigint,
  p_storage_path text,
  p_checksum text,
  p_source public.file_source default 'upload'
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
  if not public.is_staff() then
    raise exception 'Apenas a equipa interna escreve na Cloud interna.' using errcode = '42501';
  end if;

  if p_size > 26214400 then
    raise exception 'O ficheiro excede 25 MB' using errcode = '22003';
  end if;

  if p_source = 'property_document' then
    raise exception 'Documentos do imóvel entram pelo formulário do imóvel' using errcode = '42501';
  end if;

  insert into public.files (
    owner_id, folder_id, scope, name, mime, size, bucket, storage_path,
    checksum, source
  ) values (
    v_me, null, 'staff', p_name, p_mime, p_size, 'cloud', p_storage_path,
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

comment on function public.cloud_register_staff_file(text, text, bigint, text, text, public.file_source) is
  'D66/P10-10: registra um ficheiro na Cloud interna (scope staff), sem quota de plano. A única porta de escrita em files para o lado interno.';

revoke all on function public.cloud_register_staff_file(
  text, text, bigint, text, text, public.file_source
) from public, anon;
grant execute on function public.cloud_register_staff_file(
  text, text, bigint, text, text, public.file_source
) to authenticated;

-- ---------------------------------------------------------------------------
-- mail_attachment_saved_to_cloud — a nota de que aquele anexo já lá está
--
-- Guardar o mesmo anexo duas vezes não é erro de ninguém: são dois turnos a
-- olhar para a mesma mensagem. O que seria erro era ficarem dois ficheiros
-- iguais na Cloud a contar como dois. A função escreve `cloud_file_id` no
-- próprio elemento da lista e **recusa** quando já lá está um — a Server Action
-- apaga então o objeto que tinha acabado de carregar, como faz
-- `invoice_saved_to_cloud` desde a Fase 7.
-- ---------------------------------------------------------------------------

create or replace function public.mail_attachment_saved_to_cloud(
  p_message_id uuid,
  p_index integer,
  p_file_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_item jsonb;
begin
  if not public.is_support() then
    raise exception 'Apenas o Suporte guarda anexos do correio.' using errcode = '42501';
  end if;

  select attachments -> p_index into v_item
    from public.mail_messages where id = p_message_id;

  if v_item is null then
    raise exception 'Anexo inexistente.' using errcode = 'P0002';
  end if;

  if v_item ? 'cloud_file_id' then
    raise exception 'Este anexo já está na Cloud interna.' using errcode = '23505';
  end if;

  if not exists (
    select 1 from public.files
    where id = p_file_id and owner_id = v_me
      and scope = 'staff' and source = 'mail_attachment'
  ) then
    raise exception 'Ficheiro inválido.' using errcode = '42501';
  end if;

  update public.mail_messages
     set attachments = jsonb_set(
           attachments, array[p_index::text],
           v_item || jsonb_build_object('cloud_file_id', p_file_id)
         )
   where id = p_message_id;
end;
$$;

revoke all on function public.mail_attachment_saved_to_cloud(uuid, integer, uuid) from public, anon;
grant execute on function public.mail_attachment_saved_to_cloud(uuid, integer, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- mail_attachments_expired — o que o worker tem de ir apagar
--
-- Devolve caminhos, não apaga nada: quem apaga é a API de Storage (ver a nota
-- de topo). A janela mede-se pela data de **receção** e não pela de envio: um
-- servidor que esteve em baixo três dias devolve mensagens com `sent_at`
-- antigo, e contar daí encurtava a reteção sem ninguém pedir.
-- ---------------------------------------------------------------------------

create or replace function public.mail_attachments_expired(p_limit integer default 200)
returns table (message_id uuid, paths text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer;
begin
  select value::integer into v_days
    from public.app_settings
   where key = 'mail_attachment_retention_days';

  return query
  select m.id,
         array_agg(a.value ->> 'path')
    from public.mail_messages m
    cross join lateral jsonb_array_elements(m.attachments) as a(value)
   where m.received_at < now() - make_interval(days => greatest(coalesce(v_days, 180), 1))
     and a.value ->> 'path' is not null
   group by m.id
   limit greatest(coalesce(p_limit, 200), 1);
end;
$$;

revoke all on function public.mail_attachments_expired(integer) from public, anon, authenticated;
grant execute on function public.mail_attachments_expired(integer) to service_role;

-- ---------------------------------------------------------------------------
-- mail_attachment_purged — o metadado fica, o caminho sai
--
-- Chamada **depois** de o objeto já não existir. A ordem é essa e não a
-- inversa: uma lista que diz ter bytes que já não existem dá um botão que
-- devolve um 404, e o inverso — um caminho esquecido no bucket — é um objeto
-- órfão que a passagem seguinte volta a tentar apagar, sem mal nenhum.
-- ---------------------------------------------------------------------------

create or replace function public.mail_attachment_purged(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mail_messages
     set attachments = (
       select coalesce(
         jsonb_agg(
           case when a.value ? 'path'
             then (a.value - 'path') || jsonb_build_object('skipped', 'purged')
             else a.value
           end
           order by a.ordinality
         ),
         '[]'::jsonb
       )
       from jsonb_array_elements(attachments) with ordinality as a(value, ordinality)
     )
   where id = p_message_id;
end;
$$;

revoke all on function public.mail_attachment_purged(uuid) from public, anon, authenticated;
grant execute on function public.mail_attachment_purged(uuid) to service_role;
