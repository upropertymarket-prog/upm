-- ---------------------------------------------------------------------------
-- Quem vê que caixa (12 §8.1 · 07 §24.6)
-- ---------------------------------------------------------------------------
-- Até hoje, **qualquer pessoa do Suporte lia todas as mensagens de todas as
-- caixas**. Não por decisão: por omissão. As policies de `mail_threads`,
-- `mail_messages`, `mail_labels` e do bucket `mail-attachments` diziam
-- `is_staff()`, e `is_staff()` é `admin` **ou** `support`.
--
-- O que torna isto sério é o enum que já existe:
--
--     staff_department = ('suporte', 'financeiro', 'moderacao', 'admin')
--
-- Há caixas do **financeiro**. Faturas, dados bancários, correspondência com
-- contabilidade — tudo legível por quem entrou ontem para atender tickets. E
-- os anexos são o pior: o bucket guarda os ficheiros, não só os assuntos.
--
-- O modelo de dados já sabia a resposta e ninguém lha perguntava:
-- `mailboxes.department` e `mailboxes.owner_profile_id` estão lá desde P10-03,
-- e `staff_members.department` é `not null`. Esta migração liga as duas pontas.
--
-- ## A regra
--
--   * **Admin vê tudo.** É ele que administra as caixas — fechá-las ao Admin
--     seria impedir o trabalho de configuração que só ele faz.
--   * **Os outros veem a sua.** Caixa do mesmo departamento, ou caixa de que
--     são responsáveis (`owner_profile_id`).
--   * **O marketing não vê nenhuma**, como já era (07 §24.6).
--
-- ## Falha fechada, e o caso em que isso se nota
--
-- Quem não tiver linha em `staff_members` não vê caixa nenhuma. É o
-- comportamento certo — sem departamento não há âmbito que se calcule —, mas
-- é preciso saber que existe: `scripts/create-staff-user.mjs` cria as duas
-- linhas, e tem um caminho de erro que avisa "utilizador e profile prontos,
-- mas falhou staff_members". Uma conta nesse estado perde o acesso ao correio
-- e o sintoma é uma lista vazia, não um erro. Se acontecer, falta-lhe a linha.
--
-- ## O que NÃO muda
--
-- A lista de caixas continua a mostrar ao Suporte a configuração das suas
-- caixas, e a credencial continua fora de alcance: `secret_id` é só um
-- identificador do Vault e `mailbox_credential()` tem `grant` apenas à
-- `service_role`. Escrever mensagens continua a ser da `service_role`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- O âmbito, numa função só
--
-- Numa função e não repetido em cinco policies: cinco cópias de uma regra de
-- autorização divergem, e a que diverge é a que fica aberta. `security
-- definer` para poder ler `staff_members` por dentro da policy sem recursão de
-- RLS — o mesmo desenho dos helpers de papel de 02 §7.1.
-- ---------------------------------------------------------------------------
create or replace function public.staff_sees_mailbox(p_mailbox_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_staff()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.mailboxes m
        join public.staff_members s on s.profile_id = auth.uid()
        where m.id = p_mailbox_id
          and (m.department = s.department or m.owner_profile_id = auth.uid())
      )
    );
$$;

revoke all on function public.staff_sees_mailbox(uuid) from public, anon;
grant execute on function public.staff_sees_mailbox(uuid) to authenticated;

comment on function public.staff_sees_mailbox(uuid) is
  'Âmbito de leitura do correio: admin vê tudo; os outros veem o seu departamento ou a caixa de que são responsáveis.';

-- ---------------------------------------------------------------------------
-- A mesma pergunta, a partir do primeiro segmento do caminho do anexo
--
-- A convenção do bucket é `{mailbox_id}/{message_id}/{índice}-{nome}`. O cast
-- para `uuid` tem de ser à prova de lixo: um objeto com um caminho estranho
-- faria a policy **atirar** em vez de recusar, e uma policy que atira é um 500
-- onde devia estar um "não tem acesso".
--
-- As outras policies de storage deste projeto comparam o primeiro segmento
-- como **texto** (`(storage.foldername(name))[1] = auth.uid()::text`) e por
-- isso não precisam de cast nenhum. Aqui não dá: o segmento não é o dono, é a
-- caixa, e a pergunta "esta pessoa vê esta caixa?" obriga a ir à tabela.
--
-- Daí o `begin/exception`, e não um `case` com expressão regular: o
-- PostgreSQL não garante que um `case` impeça a avaliação do ramo não
-- escolhido quando ele pode ser dobrado em constante. O bloco de exceção
-- garante. Custa uma subtransação por chamada — irrelevante numa listagem de
-- anexos de uma mensagem, e o preço certo por uma policy que nunca atira.
-- ---------------------------------------------------------------------------
create or replace function public.staff_sees_mailbox_folder(p_folder text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  begin
    v_id := p_folder::uuid;
  exception
    when others then
      return false;
  end;

  return public.staff_sees_mailbox(v_id);
end;
$$;

revoke all on function public.staff_sees_mailbox_folder(text) from public, anon;
grant execute on function public.staff_sees_mailbox_folder(text) to authenticated;

-- ---------------------------------------------------------------------------
-- As policies, uma a uma
-- ---------------------------------------------------------------------------

-- A lista de caixas. O Admin mantém a sua própria policy de P10-03
-- (`mailboxes_admin_select`), por isso aqui trata-se só do resto da equipa.
drop policy if exists mailboxes_staff_select on public.mailboxes;
create policy mailboxes_staff_select on public.mailboxes
  for select using (public.staff_sees_mailbox(id));

drop policy if exists mail_threads_staff_select on public.mail_threads;
create policy mail_threads_staff_select on public.mail_threads
  for select using (public.staff_sees_mailbox(mailbox_id));

drop policy if exists mail_messages_staff_select on public.mail_messages;
create policy mail_messages_staff_select on public.mail_messages
  for select using (public.staff_sees_mailbox(mailbox_id));

-- Os marcadores são por caixa (`mail_labels_name_uidx` é
-- `(mailbox_id, lower(name))`): quem não vê a caixa não tem o que marcar.
drop policy if exists mail_labels_staff_select on public.mail_labels;
create policy mail_labels_staff_select on public.mail_labels
  for select using (public.staff_sees_mailbox(mailbox_id));

drop policy if exists mail_labels_staff_write on public.mail_labels;
create policy mail_labels_staff_write on public.mail_labels
  for all
  using (public.staff_sees_mailbox(mailbox_id))
  with check (public.staff_sees_mailbox(mailbox_id));

-- Os anexos. É aqui que estão os ficheiros, e por isso é a policy que mais
-- importa das cinco.
drop policy if exists mail_attachments_staff_select on storage.objects;
create policy mail_attachments_staff_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'mail-attachments'
    and public.staff_sees_mailbox_folder((storage.foldername(name))[1])
  );
