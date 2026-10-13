-- ---------------------------------------------------------------------------
-- mailboxes — as caixas de e-mail do Suporte (P10-03 · 05 §1.8 · 04 §2.5)
--
-- Primeira tabela da Fase 10 · Parte 2. O ecrã que a edita é
-- `/admin/caixas-email`, que 04 §2.5 marca como **restrito a admin**: "criar/
-- editar caixa (IMAP recomendado / POP3, SMTP, testar ligação), associar
-- departamento e responsável".
--
-- A entrada de correio não passa pelo Resend. 07 §24.2 separa os dois sistemas
-- e a confusão entre eles fica registada lá para não voltar: o **Resend é só
-- saída** (notificações, campanhas, o e-mail do contrato de adesão); a
-- **entrada é IMAP/SMTP da Amen**, lida pelo mail-worker (02 §3.2). O Resend
-- não recebe correio nenhum.
--
-- ## A palavra-passe não vive aqui, e é a regra que não se dobra
--
-- 05 §1.8 dá à tabela um `secret_id`, não uma coluna de palavra-passe, e 07
-- §24.2 é explícito: "com as credenciais no Supabase Vault e **nunca na
-- tabela**". Esta migração cumpre isso de três maneiras:
--
--  1. não existe coluna nenhuma que possa guardar uma palavra-passe;
--  2. `secret_id` é só o identificador do segredo no Vault — sozinho não abre
--     nada, e quem o lê sem ser `service_role` não consegue decifrar;
--  3. a escrita do segredo passa por `save_mailbox_secret()`, que o recebe,
--     entrega ao Vault e **nunca o devolve**. Não há caminho de leitura a
--     partir de uma sessão: quem precisa da palavra-passe é o mail-worker, que
--     corre com `service_role` e lê `vault.decrypted_secrets` diretamente.
--
-- O Vault é uma extensão e pode não existir em todas as instâncias (CI,
-- Postgres local sem a imagem do Supabase). Por isso a sua criação vai dentro
-- de um `do $$` que verifica a disponibilidade — o mesmo arranjo que o
-- `pg_cron` já usa nesta pasta. Sem Vault, a tabela cria-se na mesma e é só a
-- gravação do segredo que falha, com erro explícito em vez de silêncio.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'supabase_vault') then
    execute 'create extension if not exists supabase_vault with schema vault';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enums
--
-- `in_security` e `smtp_security` partilham o mesmo tipo: são a mesma escolha
-- feita duas vezes, e um tipo por ponta divergiria à primeira alteração.
-- `none` existe porque há servidores antigos que ainda o exigem — o ecrã
-- desaconselha-o, a base de dados não o proíbe.
-- ---------------------------------------------------------------------------

create type public.mail_protocol as enum ('imap', 'pop3');
create type public.mail_security as enum ('ssl_tls', 'starttls', 'none');

-- `error` não é um estado que alguém escolha: é o mail-worker a marcá-lo
-- quando uma sincronização falha, com o motivo em `last_error`. `paused` é o
-- que um admin usa para parar a leitura sem apagar a configuração.
create type public.mailbox_status as enum ('active', 'paused', 'error');

create table public.mailboxes (
  id uuid primary key default gen_random_uuid(),

  -- `text` e não `citext`: o projeto não usa a extensão em lado nenhum (os
  -- e-mails de `site_leads` e de `admin_users` são `text`), e introduzi-la por
  -- uma coluna seria uma dependência nova para um problema que um índice
  -- único em `lower()` resolve. O `check` é o mesmo de `site_leads.email`.
  address text not null check (length(address) between 3 and 320),
  display_name text not null default '',

  protocol public.mail_protocol not null default 'imap',
  in_host text not null,
  in_port integer not null check (in_port between 1 and 65535),
  in_security public.mail_security not null default 'ssl_tls',

  smtp_host text not null,
  smtp_port integer not null check (smtp_port between 1 and 65535),
  smtp_security public.mail_security not null default 'starttls',

  username text not null,
  -- O identificador do segredo no Vault. Nulo enquanto a palavra-passe não for
  -- gravada — e uma caixa sem segredo não sincroniza, que é o comportamento
  -- certo: melhor não ler do que ler com credenciais adivinhadas.
  secret_id uuid,

  -- O enum que `staff_members` já usa, e não texto livre: é o mesmo
  -- vocabulário, e dois sítios a escrever "suporte"/"Suporte"/"apoio" para a
  -- mesma coisa é a forma mais barata de impedir um filtro por departamento de
  -- funcionar. 05 §1.8 não lhe dá tipo; o projeto já tem um.
  department public.staff_department not null default 'suporte',

  -- O responsável pela caixa. É de quem saem as variáveis da assinatura
  -- (05 §1.8, `email_signatures`, resolvidas "a partir de `staff_members` do
  -- dono da caixa"), e o caminho é `profiles` → `staff_members.profile_id`,
  -- que é único. `set null` e não `cascade`: quem sai da equipa não leva a
  -- caixa de Suporte atrás de si — a caixa fica, sem responsável, à espera de
  -- um novo.
  owner_profile_id uuid references public.profiles (id) on delete set null,

  status public.mailbox_status not null default 'active',
  last_sync_at timestamptz,
  last_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.mailboxes is
  'P10-03 · 05 §1.8: caixas IMAP/POP3+SMTP do Suporte. A palavra-passe vive no Vault (secret_id), nunca aqui.';
comment on column public.mailboxes.secret_id is
  'Identificador do segredo no Supabase Vault. Sozinho não abre nada; só a service_role decifra.';
comment on column public.mailboxes.last_error is
  'Preenchido pelo mail-worker quando a sincronização falha. Mensagem do servidor, nunca a credencial.';

-- Único sem distinguir maiúsculas: `Suporte@…` e `suporte@…` são a mesma
-- caixa, e duas linhas para o mesmo servidor dariam duas sincronizações a
-- disputar as mesmas mensagens.
create unique index mailboxes_address_key on public.mailboxes (lower(address));
create index mailboxes_status_idx on public.mailboxes (status);
create index mailboxes_owner_idx on public.mailboxes (owner_profile_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.touch_mailboxes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger mailboxes_touch
  before update on public.mailboxes
  for each row execute function public.touch_mailboxes();

-- ---------------------------------------------------------------------------
-- RLS — só admin, e por agora só admin
--
-- 04 §2.5 diz "restrito a admin" e é o que se aplica. O Suporte vai precisar
-- de ler a lista para o seletor de caixa de `/suporte/email`, mas isso é
-- P10-04 e abre-se lá, com a policy que esse ecrã justificar — abrir agora
-- seria dar leitura a quem ainda não tem ecrã nenhum que a use.
-- ---------------------------------------------------------------------------

alter table public.mailboxes enable row level security;

create policy mailboxes_admin_select on public.mailboxes
  for select using (public.is_admin());

create policy mailboxes_admin_insert on public.mailboxes
  for insert with check (public.is_admin());

create policy mailboxes_admin_update on public.mailboxes
  for update using (public.is_admin()) with check (public.is_admin());

create policy mailboxes_admin_delete on public.mailboxes
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- save_mailbox_secret — a única porta de entrada da palavra-passe
--
-- `security definer` para poder escrever no Vault, que nenhuma sessão alcança.
-- Verifica `is_admin()` **lá dentro**: a RLS da tabela não protege uma função
-- definer, e sem esta verificação qualquer sessão autenticada podia gravar
-- credenciais numa caixa de Suporte.
--
-- Não devolve o segredo nem o `secret_id` — devolve apenas se correu bem. Uma
-- função que devolvesse o id daria a quem o tivesse um ponteiro para o Vault
-- sem necessidade nenhuma.
-- ---------------------------------------------------------------------------

create or replace function public.save_mailbox_secret(p_mailbox_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_address text;
begin
  if not public.is_admin() then
    raise exception 'Apenas um administrador pode gravar credenciais de caixa de e-mail.'
      using errcode = '42501';
  end if;

  if p_password is null or length(p_password) = 0 then
    raise exception 'A palavra-passe não pode ser vazia.' using errcode = '22023';
  end if;

  select secret_id, address::text into v_secret_id, v_address
    from public.mailboxes where id = p_mailbox_id;

  if not found then
    raise exception 'Caixa de e-mail inexistente.' using errcode = 'P0002';
  end if;

  if to_regnamespace('vault') is null then
    raise exception 'O Supabase Vault não está disponível nesta instância.'
      using errcode = '0A000';
  end if;

  if v_secret_id is null then
    -- O nome do segredo leva o id da caixa e não o endereço: um endereço pode
    -- ser corrigido, o id não muda, e um segredo órfão com o nome antigo seria
    -- impossível de reconciliar depois.
    v_secret_id := vault.create_secret(
      p_password,
      'mailbox:' || p_mailbox_id::text,
      'Credencial IMAP/SMTP de ' || coalesce(v_address, '(sem endereço)')
    );
    update public.mailboxes set secret_id = v_secret_id where id = p_mailbox_id;
  else
    perform vault.update_secret(v_secret_id, p_password);
  end if;
end;
$$;

comment on function public.save_mailbox_secret(uuid, text) is
  'P10-03: grava a palavra-passe da caixa no Vault e guarda só o secret_id. Nunca devolve o segredo.';

revoke all on function public.save_mailbox_secret(uuid, text) from public, anon;
grant execute on function public.save_mailbox_secret(uuid, text) to authenticated;
