-- ---------------------------------------------------------------------------
-- Correio do Suporte: onde o mail-worker escreve (P10-03 · 05 §1.8)
--
-- A migração anterior (20261013100000) deu ao Admin o ecrã para **configurar**
-- uma caixa. Esta dá ao `mail-worker` o sítio onde **pôr o que lê** e a única
-- porta por onde pode ler a credencial. Sem as duas, o worker é um processo
-- que se liga a um servidor IMAP e deita o resultado fora.
--
-- ## Três decisões que moram aqui, e não no worker
--
-- 1. **A credencial lê-se por uma função, não por uma tabela.** O Vault vive no
--    schema `vault`, que o PostgREST não expõe — e expô-lo seria dar a toda a
--    gente com uma chave um caminho para os segredos. `mailbox_credential()` é
--    `security definer`, não tem `grant` para `anon` nem `authenticated`, e só
--    a `service_role` a pode executar. É a simétrica de `save_mailbox_secret()`:
--    uma escreve e nunca devolve, a outra devolve e só ao worker.
-- 2. **A deduplicação é da base de dados, não do worker.** `message_id` é o
--    identificador que o servidor de correio dá a cada mensagem (RFC 5322), e o
--    índice único por caixa garante que uma sincronização repetida não duplica
--    nada. Um worker reiniciado a meio tem de poder voltar a correr o mesmo
--    intervalo sem estragar a caixa — e tem, porque o `insert` é idempotente.
-- 3. **A equipa lê, o worker escreve.** As três tabelas têm `select` para
--    `is_staff()` (admin e suporte, nunca marketing — 07 §24.6) e **nenhuma
--    policy de escrita**: quem escreve é a `service_role`, que não passa pela
--    RLS. As escritas da equipa — marcar como lida, arquivar, criar marcador —
--    chegam com o ecrã que as faz, em P10-04. Dar agora `update` a quem ainda
--    não tem botão nenhum é abrir caminho sem ter porta.
-- ---------------------------------------------------------------------------

-- 05 §1.8: "folder (inbox|sent|drafts|archive)". `scheduled` entra com P10-09,
-- quando houver envio agendado para lá pôr.
create type public.mail_folder as enum ('inbox', 'sent', 'drafts', 'archive');

-- ---------------------------------------------------------------------------
-- `sending` — o estado que faltava à fila de saída
--
-- `notification_deliveries` nasceu na Fase 5 com `queued | sent | failed |
-- cancelled`, quando ainda não havia nada a drenar a fila. Com o worker a
-- drenar, falta o estado do meio: sem ele, duas passagens sobrepostas leem a
-- mesma linha `queued` e enviam o mesmo e-mail duas vezes. O worker reclama a
-- entrega com `update ... where status = 'queued'` — é a base de dados a
-- decidir quem fica com ela — e só depois envia.
--
-- Uma entrega que fique presa em `sending` porque o processo morreu a meio é
-- deliberadamente **não** reenviada em automático: duplicar um aviso é pior do
-- que atrasá-lo, e uma linha presa é visível. A reposição é manual até haver
-- ecrã que a faça.
-- ---------------------------------------------------------------------------

alter type public.delivery_status add value if not exists 'sending';

-- ---------------------------------------------------------------------------
-- mailbox_credential — a única leitura do segredo, e só para a service_role
-- ---------------------------------------------------------------------------

create or replace function public.mailbox_credential(p_mailbox_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_password text;
begin
  select secret_id into v_secret_id from public.mailboxes where id = p_mailbox_id;

  if v_secret_id is null then
    return null;
  end if;

  if to_regnamespace('vault') is null then
    raise exception 'O Supabase Vault não está disponível nesta instância.'
      using errcode = '0A000';
  end if;

  select decrypted_secret into v_password
    from vault.decrypted_secrets where id = v_secret_id;

  return v_password;
end;
$$;

comment on function public.mailbox_credential(uuid) is
  'P10-03: devolve a palavra-passe da caixa ao mail-worker. Só a service_role a executa; nenhuma sessão a alcança.';

revoke all on function public.mailbox_credential(uuid) from public, anon, authenticated;
grant execute on function public.mailbox_credential(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- mail_threads — a conversa, para a lista não ser uma pilha de mensagens soltas
--
-- O agrupamento é por `References`/`In-Reply-To` quando existem e, quando não
-- existem, pelo assunto normalizado: é o que os clientes de e-mail fazem, e um
-- servidor que não envie cabeçalhos de referência é comum demais para não ter
-- resposta. `thread_key` guarda o critério que agrupou, para o worker poder
-- reconciliar sem adivinhar outra vez.
-- ---------------------------------------------------------------------------

create table public.mail_threads (
  id uuid primary key default gen_random_uuid(),
  mailbox_id uuid not null references public.mailboxes (id) on delete cascade,
  thread_key text not null,
  subject text not null default '',
  last_message_at timestamptz not null default now(),
  message_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index mail_threads_key_uidx on public.mail_threads (mailbox_id, thread_key);
create index mail_threads_recent_idx on public.mail_threads (mailbox_id, last_message_at desc);

create trigger mail_threads_set_updated_at
  before update on public.mail_threads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- mail_messages — 05 §1.8
--
-- `ticket_id` é o "Criar ticket a partir do e-mail" de 04 §2.5, e fica desde já
-- com a referência: nasce nulo e só P10-04 o preenche, mas a coluna existir
-- agora evita uma migração só para ela.
-- ---------------------------------------------------------------------------

create table public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  mailbox_id uuid not null references public.mailboxes (id) on delete cascade,
  thread_id uuid references public.mail_threads (id) on delete set null,

  -- O `Message-ID` do servidor. `not null` porque é a chave da idempotência;
  -- quando a mensagem não traz um (acontece em servidores antigos), o worker
  -- sintetiza um estável a partir da caixa, da data e do assunto.
  message_id text not null,
  in_reply_to text,

  from_address text not null default '',
  from_name text not null default '',
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  bcc_addresses text[] not null default '{}',

  subject text not null default '',
  html text,
  text_body text,

  folder public.mail_folder not null default 'inbox',
  is_read boolean not null default false,
  is_starred boolean not null default false,
  labels uuid[] not null default '{}',
  attachments jsonb not null default '[]'::jsonb,

  ticket_id uuid references public.tickets (id) on delete set null,

  -- A data que o servidor diz (`Date:`), separada da data a que a lemos. Quando
  -- um servidor esteve em baixo três dias, as duas afastam-se — e a lista
  -- ordena-se pela primeira, que é a que o utilizador reconhece.
  sent_at timestamptz,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.mail_messages is
  'P10-03 · 05 §1.8: mensagens lidas pelo mail-worker. Escrita só service_role; a equipa lê.';

create unique index mail_messages_dedupe_uidx on public.mail_messages (mailbox_id, message_id);
create index mail_messages_folder_idx
  on public.mail_messages (mailbox_id, folder, coalesce(sent_at, received_at) desc);
create index mail_messages_thread_idx on public.mail_messages (thread_id);
create index mail_messages_ticket_idx on public.mail_messages (ticket_id)
  where ticket_id is not null;

create trigger mail_messages_set_updated_at
  before update on public.mail_messages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- mail_labels — 05 §1.8 (marcadores com cor, por caixa)
-- ---------------------------------------------------------------------------

create table public.mail_labels (
  id uuid primary key default gen_random_uuid(),
  mailbox_id uuid not null references public.mailboxes (id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  -- Um token do design system (`--accent`, `--success`, …), não um hexadecimal:
  -- 04 §5.1 proíbe cores fixas, e um marcador guardado como `#ff6a00` ficaria
  -- errado no tema escuro e invisível numa mudança de paleta.
  color text not null default 'accent',
  created_at timestamptz not null default now()
);

create unique index mail_labels_name_uidx on public.mail_labels (mailbox_id, lower(name));

-- ---------------------------------------------------------------------------
-- RLS — a equipa de suporte lê; escrever é da service_role (ver nota de topo)
-- ---------------------------------------------------------------------------

alter table public.mail_threads enable row level security;
alter table public.mail_messages enable row level security;
alter table public.mail_labels enable row level security;

create policy mail_threads_staff_select on public.mail_threads
  for select using (public.is_staff());

create policy mail_messages_staff_select on public.mail_messages
  for select using (public.is_staff());

create policy mail_labels_staff_select on public.mail_labels
  for select using (public.is_staff());
