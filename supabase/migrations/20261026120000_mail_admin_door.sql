-- ---------------------------------------------------------------------------
-- A caixa de e-mail abre-se ao Admin (26 out 2026)
-- ===========================================================================
-- O Admin não tinha onde enviar nem receber e-mail. Tinha
-- `/admin/caixas-email`, que é a **configuração** — servidor, porta,
-- credencial, ligar e desligar a leitura — e nada que mostre uma mensagem.
-- Pedido do cliente a 26 out 2026: o Admin precisa de uma caixa a sério.
--
-- ## Isto contradiz uma decisão anterior, e a contradição é deliberada
--
-- `20261013120000_mail_actions.sql` criou `is_support()` com um comentário
-- explícito: *"O Admin NÃO entra: o workflow de suporte é do Suporte
-- (07 §5.10)"*. A leitura do correio já era `is_staff()` — o Admin sempre
-- **viu** as mensagens —, mas cada escrita recusava-o.
--
-- O raciocínio de 13 out era por analogia com `/admin/tickets`: um ticket tem
-- um dono e uma fila, e um admin a mexer nessa fila por cima do turno estraga
-- o trabalho de quem está nela. **O correio não é isso.** Uma caixa partilhada
-- não tem fila nem atribuição, e o Admin é quem configura as caixas: dizer-lhe
-- que pode criar a caixa `geral@` e ligar-lhe o IMAP, mas não pode responder a
-- uma mensagem que lá cai, é uma regra que só se explica pela analogia que a
-- gerou. A analogia é que estava errada, não o 07 §5.10.
--
-- ## O que **não** se alarga
--
-- `create_ticket_from_mail` fica em `is_support()`. É a única escrita do correio
-- que não acaba no correio — abre um ticket, que é a fila de outra pessoa, e aí
-- o 07 §5.10 continua inteiro e pela sua razão original. O ecrã do Admin não
-- mostra esse botão (ver `/admin/email/page.tsx`).
--
-- E fica `is_staff()`, não `is_internal()`: o **marketing continua fora** do
-- correio, por 07 §24.6. Alargar a dois papéis que leem a caixa é diferente de
-- a dar a toda a equipa interna.
--
-- ## Porque é uma migração nova
--
-- Pela mesma razão de `20261021120000_seo_marketing_door.sql`: o `supabase`
-- identifica uma migração pelo prefixo, não pelo conteúdo, e editar a 13 out no
-- sítio não a faz voltar a correr onde já passou. Ficava a diferença entre duas
-- bases com o mesmo número e ninguém a ver.
--
-- As funções são recriadas **por inteiro** a partir das originais, com uma
-- linha diferente — a do papel. Um `create or replace` parcial não existe, e
-- reescrever o corpo de memória era a forma de perder a validação dos
-- marcadores de outra caixa ou a recusa de mover para `sent`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Marcadores — a policy que os protege
--
-- A original chamava-se `mail_labels_support_write`. O nome passa a dizer o que
-- a regra faz: uma policy chamada "support" a deixar entrar o admin é a próxima
-- pessoa a ler isto a concluir o contrário do que está escrito.
-- ---------------------------------------------------------------------------
drop policy if exists mail_labels_support_write on public.mail_labels;
create policy mail_labels_staff_write on public.mail_labels
  for all using (public.is_staff()) with check (public.is_staff());

comment on policy mail_labels_staff_write on public.mail_labels is
  'Admin e Suporte criam, renomeiam e apagam marcadores. O marketing fica fora (07 §24.6).';

-- ---------------------------------------------------------------------------
-- 2. mail_set_flags — lida / não lida e estrela
-- ---------------------------------------------------------------------------
create or replace function public.mail_set_flags(
  p_message_id uuid,
  p_is_read boolean default null,
  p_is_starred boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Apenas a equipa interna pode alterar o estado de uma mensagem.'
      using errcode = '42501';
  end if;

  update public.mail_messages
     set is_read = coalesce(p_is_read, is_read),
         is_starred = coalesce(p_is_starred, is_starred)
   where id = p_message_id;

  if not found then
    raise exception 'Mensagem inexistente.' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. mail_move — arquivar e desarquivar
--
-- `sent` e `drafts` continuam a não ser destinos de uma ação de utilizador: uma
-- mensagem está em `sent` porque foi enviada, não porque alguém a arrastou para
-- lá. Mover para esses valores mentiria sobre a origem da mensagem.
-- ---------------------------------------------------------------------------
create or replace function public.mail_move(p_message_id uuid, p_folder public.mail_folder)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Apenas a equipa interna pode arquivar mensagens.' using errcode = '42501';
  end if;

  if p_folder not in ('inbox', 'archive') then
    raise exception 'Só é possível mover entre a entrada e o arquivo.'
      using errcode = '22023';
  end if;

  update public.mail_messages set folder = p_folder where id = p_message_id;

  if not found then
    raise exception 'Mensagem inexistente.' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. mail_set_labels — substitui o conjunto, e valida a caixa
--
-- Sem a validação, um marcador da caixa "faturacao@" podia ser colado numa
-- mensagem de "suporte@", e o filtro por marcador passava a devolver correio de
-- outra caixa — com o nome de um marcador que ali não existe.
-- ---------------------------------------------------------------------------
create or replace function public.mail_set_labels(p_message_id uuid, p_labels uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mailbox uuid;
  v_labels uuid[] := coalesce(p_labels, '{}');
  v_alheios integer;
begin
  if not public.is_staff() then
    raise exception 'Apenas a equipa interna pode etiquetar mensagens.' using errcode = '42501';
  end if;

  select mailbox_id into v_mailbox from public.mail_messages where id = p_message_id;
  if not found then
    raise exception 'Mensagem inexistente.' using errcode = 'P0002';
  end if;

  select count(*) into v_alheios
    from unnest(v_labels) as wanted(id)
    left join public.mail_labels l on l.id = wanted.id and l.mailbox_id = v_mailbox
   where l.id is null;

  if v_alheios > 0 then
    raise exception 'Há marcadores que não pertencem a esta caixa.' using errcode = '22023';
  end if;

  update public.mail_messages set labels = v_labels where id = p_message_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. mail_save_draft — o rascunho, que é a exceção controlada
--
-- Recriada de `20261014090000_mail_compose.sql`. Continua a ser a única
-- escrita direta em `mail_messages` a partir de uma sessão, e continua a ser
-- segura pela mesma razão: um rascunho é nosso, nunca saiu, e o `message_id`
-- leva o prefixo `draft:` para nunca colidir com o de um servidor de correio.
-- O envio continua a passar pelo worker, com `service_role`.
-- ---------------------------------------------------------------------------
create or replace function public.mail_save_draft(
  p_mailbox_id uuid,
  p_draft_id uuid default null,
  p_to text[] default '{}',
  p_cc text[] default '{}',
  p_bcc text[] default '{}',
  p_subject text default '',
  p_html text default '',
  p_text text default '',
  p_in_reply_to text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_address text;
begin
  if not public.is_staff() then
    raise exception 'Apenas a equipa interna pode escrever correio.' using errcode = '42501';
  end if;

  select address into v_address from public.mailboxes where id = p_mailbox_id;
  if not found then
    raise exception 'Caixa de e-mail inexistente.' using errcode = 'P0002';
  end if;

  if p_draft_id is not null then
    update public.mail_messages
       set to_addresses = coalesce(p_to, '{}'),
           cc_addresses = coalesce(p_cc, '{}'),
           bcc_addresses = coalesce(p_bcc, '{}'),
           subject = coalesce(p_subject, ''),
           html = p_html,
           text_body = p_text,
           in_reply_to = p_in_reply_to
     where id = p_draft_id and folder = 'drafts'
    returning id into v_id;

    -- Um rascunho que já foi enviado deixou de ser rascunho: a atualização não
    -- encontra nada e o composer recebe a resposta em vez de gravar por cima
    -- de uma mensagem enviada.
    if v_id is null then
      raise exception 'Este rascunho já não existe.' using errcode = 'P0002';
    end if;

    return v_id;
  end if;

  insert into public.mail_messages (
    mailbox_id, message_id, folder, is_read,
    from_address, from_name, to_addresses, cc_addresses, bcc_addresses,
    subject, html, text_body, in_reply_to
  )
  values (
    p_mailbox_id,
    -- O `message_id` real nasce no envio; até lá, um identificador nosso, com
    -- prefixo próprio para nunca colidir com o de um servidor de correio.
    'draft:' || gen_random_uuid()::text,
    'drafts',
    true,
    v_address,
    '',
    coalesce(p_to, '{}'),
    coalesce(p_cc, '{}'),
    coalesce(p_bcc, '{}'),
    coalesce(p_subject, ''),
    p_html,
    p_text,
    p_in_reply_to
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. mail_discard_draft — só apaga o que ainda é rascunho
-- ---------------------------------------------------------------------------
create or replace function public.mail_discard_draft(p_draft_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Apenas a equipa interna pode apagar rascunhos.' using errcode = '42501';
  end if;

  delete from public.mail_messages where id = p_draft_id and folder = 'drafts';
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. mail_attachment_saved_to_cloud — a nota de que o anexo já lá está
--
-- Recriada de `20261014100000_mail_attachments.sql`. A Cloud interna é
-- `scope = 'staff'` e o Admin já a lê; recusar-lhe o "Guardar na Cloud" era
-- deixar-lhe o botão a dar erro no ecrã que acabámos de lhe dar.
--
-- A verificação de `owner_id = auth.uid()` fica: é ela que impede alguém de
-- apontar o anexo para um ficheiro de outra pessoa.
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
  if not public.is_staff() then
    raise exception 'Apenas a equipa interna guarda anexos do correio.' using errcode = '42501';
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
           attachments,
           array[p_index::text],
           v_item || jsonb_build_object('cloud_file_id', p_file_id)
         )
   where id = p_message_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. O comentário de `is_support()` deixa de mentir
--
-- A função **continua a existir e continua a ser só do Suporte** — é o que
-- `create_ticket_from_mail` usa. O que muda é o comentário: dizia que o Admin
-- não entra "no workflow de suporte", e a partir de hoje entra no correio.
-- Um comentário desatualizado numa função de permissões é pior do que nenhum.
-- ---------------------------------------------------------------------------
comment on function public.is_support() is
  'Verdadeiro para o papel support. Desde 26 out 2026 restringe só o que sai do '
  'correio para a fila de outra pessoa — create_ticket_from_mail (07 §5.10). '
  'O trabalho dentro da caixa é is_staff(): o Admin tem /admin/email.';
