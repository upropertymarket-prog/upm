-- ---------------------------------------------------------------------------
-- O composer: rascunhos e enviados (P10-05 · 04 §2.5)
--
-- A caixa de entrada (P10-04) só lia. Escrever levanta uma pergunta que a
-- leitura não tinha: **quem escreve a linha de uma mensagem nossa?**
--
-- A resposta é a mesma de todo o correio: a aplicação nunca escreve em
-- `mail_messages` diretamente. Um rascunho passa por `mail_save_draft()` e um
-- envio por `mail_record_sent()`, chamada pelo `mail-worker` **depois** de o
-- SMTP aceitar a mensagem. É por isso que não há aqui policy de `insert`:
--
--  - se a app pudesse inserir em `folder = 'sent'`, bastava um erro de
--    programação para a caixa mostrar como enviado o que nunca saiu — e numa
--    caixa de suporte isso é dizer ao cliente que lhe respondemos quando não
--    respondemos;
--  - o `message_id` de uma mensagem enviada é o que o servidor SMTP devolve.
--    Inventá-lo do lado da app partia a correspondência entre o que está na
--    caixa e o que existe no servidor de correio.
--
-- O rascunho é a exceção controlada: é nosso, nunca saiu, e tem de poder ser
-- reescrito muitas vezes. `mail_save_draft()` devolve o `id` para o composer
-- continuar a gravar por cima do mesmo rascunho em vez de deixar um rasto de
-- cópias a cada pausa de escrita.
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
  if not public.is_support() then
    raise exception 'Apenas o Suporte pode escrever correio.' using errcode = '42501';
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

revoke all on function public.mail_save_draft(
  uuid, uuid, text[], text[], text[], text, text, text, text
) from public, anon;
grant execute on function public.mail_save_draft(
  uuid, uuid, text[], text[], text[], text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- mail_discard_draft — só apaga o que ainda é rascunho
-- ---------------------------------------------------------------------------

create or replace function public.mail_discard_draft(p_draft_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_support() then
    raise exception 'Apenas o Suporte pode apagar rascunhos.' using errcode = '42501';
  end if;

  delete from public.mail_messages where id = p_draft_id and folder = 'drafts';
end;
$$;

revoke all on function public.mail_discard_draft(uuid) from public, anon;
grant execute on function public.mail_discard_draft(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- mail_record_sent — chamada pelo mail-worker, nunca pela aplicação
--
-- `service_role` e mais ninguém: é o worker que fala com o SMTP e é o worker
-- que sabe se a mensagem saiu. Quando o rascunho existe, a linha é promovida a
-- `sent` em vez de duplicada — a mensagem é a mesma, o estado é que mudou.
-- ---------------------------------------------------------------------------

create or replace function public.mail_record_sent(
  p_mailbox_id uuid,
  p_message_id text,
  p_to text[],
  p_cc text[],
  p_bcc text[],
  p_subject text,
  p_html text,
  p_text text,
  p_from_name text default '',
  p_draft_id uuid default null,
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
  select address into v_address from public.mailboxes where id = p_mailbox_id;
  if not found then
    raise exception 'Caixa de e-mail inexistente.' using errcode = 'P0002';
  end if;

  if p_draft_id is not null then
    update public.mail_messages
       set folder = 'sent',
           message_id = p_message_id,
           to_addresses = coalesce(p_to, '{}'),
           cc_addresses = coalesce(p_cc, '{}'),
           bcc_addresses = coalesce(p_bcc, '{}'),
           subject = coalesce(p_subject, ''),
           html = p_html,
           text_body = p_text,
           from_name = coalesce(p_from_name, ''),
           in_reply_to = p_in_reply_to,
           sent_at = now()
     where id = p_draft_id
    returning id into v_id;

    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.mail_messages (
    mailbox_id, message_id, folder, is_read,
    from_address, from_name, to_addresses, cc_addresses, bcc_addresses,
    subject, html, text_body, in_reply_to, sent_at
  )
  values (
    p_mailbox_id, p_message_id, 'sent', true,
    v_address, coalesce(p_from_name, ''),
    coalesce(p_to, '{}'), coalesce(p_cc, '{}'), coalesce(p_bcc, '{}'),
    coalesce(p_subject, ''), p_html, p_text, p_in_reply_to, now()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.mail_record_sent(
  uuid, text, text[], text[], text[], text, text, text, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.mail_record_sent(
  uuid, text, text[], text[], text[], text, text, text, text, uuid, text
) to service_role;

-- ---------------------------------------------------------------------------
-- email_signatures — 05 §1.8
--
-- O composer insere a assinatura da caixa automaticamente (04 §2.5), e por isso
-- a tabela nasce aqui e não em P10-06: sem ela, o composer teria de inventar
-- uma assinatura ou não ter nenhuma. **O editor** de assinaturas é que é P10-06;
-- o que esta migração dá é onde elas vivem e quem as lê.
--
-- `html` é guardado como vem do editor e **sanitizado na escrita** (02 §4.3,
-- P10-06). Enquanto o editor não existir, só a `service_role` escreve — e por
-- isso não há policy de escrita nenhuma.
-- ---------------------------------------------------------------------------

create table public.email_signatures (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  html text not null default '',
  -- Uma caixa tem uma assinatura; uma assinatura pode servir várias caixas
  -- (05 §1.8). O array evita uma tabela de junção para uma relação que, na
  -- prática, tem meia dúzia de linhas.
  mailbox_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger email_signatures_set_updated_at
  before update on public.email_signatures
  for each row execute function public.set_updated_at();

alter table public.email_signatures enable row level security;

create policy email_signatures_staff_select on public.email_signatures
  for select using (public.is_staff());

comment on table public.email_signatures is
  'P10-05/P10-06 · 05 §1.8: assinaturas de e-mail. O composer lê; o editor (P10-06) escreve.';

-- A assinatura de uma caixa, resolvida com as variáveis de quem é dono dela
-- (05 §1.8: `{{nome}}`, `{{cargo}}`, `{{departamento}}`, `{{email}}`,
-- `{{telefone}}`, `{{iniciais}}`). Uma função e não um `select` na app: o
-- composer e, amanhã, as campanhas têm de resolver isto da mesma maneira.
create or replace function public.mailbox_signature(p_mailbox_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_html text;
  v_name text := '';
  v_title text := '';
  v_department text := '';
  v_phone text := '';
  v_email text := '';
begin
  if not public.is_staff() then
    return '';
  end if;

  select s.html into v_html
    from public.email_signatures s
   where p_mailbox_id = any (s.mailbox_ids)
   order by s.created_at
   limit 1;

  if v_html is null or v_html = '' then
    return '';
  end if;

  select coalesce(p.full_name, ''), coalesce(sm.title, ''),
         coalesce(sm.department::text, ''), coalesce(sm.phone, ''), coalesce(m.address, '')
    into v_name, v_title, v_department, v_phone, v_email
    from public.mailboxes m
    left join public.profiles p on p.id = m.owner_profile_id
    left join public.staff_members sm on sm.profile_id = m.owner_profile_id
   where m.id = p_mailbox_id;

  v_html := replace(v_html, '{{nome}}', v_name);
  v_html := replace(v_html, '{{cargo}}', v_title);
  v_html := replace(v_html, '{{departamento}}', v_department);
  v_html := replace(v_html, '{{telefone}}', v_phone);
  v_html := replace(v_html, '{{email}}', v_email);
  v_html := replace(
    v_html, '{{iniciais}}',
    upper(left(coalesce(nullif(v_name, ''), v_email), 1))
  );

  return v_html;
end;
$$;

revoke all on function public.mailbox_signature(uuid) from public, anon;
grant execute on function public.mailbox_signature(uuid) to authenticated, service_role;
