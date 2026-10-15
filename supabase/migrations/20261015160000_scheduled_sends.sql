-- ---------------------------------------------------------------------------
-- scheduled_sends — o agendamento que dispara (P10-09 · 05 §1.9 · 04 §2.6)
--
-- P10-08 deixou `campaign_schedule()` a pôr **estado e data**, com a nota de
-- que "quem dispara é P10-09, e o índice `campaigns_due_idx` existe à espera
-- disso". É esta migração. Uma campanha agendada para as 9h passa a sair às 9h
-- sem ninguém clicar.
--
-- ## Porque é que não basta ler `campaigns.scheduled_at`
--
-- O índice existe e a consulta seria trivial — mas o doc 05 desenha uma tabela
-- própria, e tem razão por três motivos que só aparecem quando se tenta sem
-- ela:
--
-- 1. **Um disparo tem estado próprio.** "Agendada" é da campanha; "já tentei
--    disparar e falhou" é do disparo. Guardar o segundo em `campaigns` obrigava
--    a um estado `scheduled_failed` que não quer dizer nada para quem olha para
--    a lista de campanhas.
-- 2. **O que se agenda não é só campanhas.** `kind` tem dois valores por
--    desenho: `campaign_email` e `direct` — um e-mail do composer do Suporte
--    enviado mais tarde. Ver a nota de `scheduled_send_kind`, mais abaixo.
-- 3. **Um agendamento cancelado deixa rasto.** `cancelled` fica na tabela; a
--    campanha volta a `draft` e não há como saber, por ela, que esteve agendada
--    para uma hora que passou.
--
-- ## Dois motores, e o segundo não é redundância a mais
--
-- O doc diz "executado por `pg_cron` + `mail-worker`", e são de facto os dois:
-- o `pg_cron` chama `scheduled_sends_run()` a cada minuto **dentro** do
-- Postgres, e o worker chama a mesma função em cada passagem do seu ciclo de
-- campanhas. Não é duplicação por acidente:
--
-- - O `pg_cron` é o que faz o agendamento funcionar **sem o worker a correr**.
-- - O worker é o que faz funcionar em **desenvolvimento**, onde a extensão
--   muitas vezes não existe (ver a guarda no fim do ficheiro), e é a rede para
--   um `pg_cron` que pare sem ninguém notar.
--
-- A função é idempotente e reclama cada linha com `for update skip locked`, por
-- isso os dois a correrem ao mesmo tempo não disparam o mesmo envio duas vezes.
-- ---------------------------------------------------------------------------

/**
 * `direct` nasce **sem produtor**, e é deliberado — a mesma figura de
 * `is_internal()`, que nasceu sem chamador em `20261014120100`.
 *
 * É o "enviar mais tarde" do composer de `/suporte/email`, que o doc 05 prevê
 * e que nenhum ecrã oferece hoje. O valor entra agora porque `alter type ...
 * add value` tem de ficar sozinho num ficheiro de migração, e descobri-lo no
 * dia em que o botão for desenhado custava uma migração extra por nada.
 */
create type public.scheduled_send_kind as enum ('direct', 'campaign_email');

create type public.scheduled_send_status as enum ('scheduled', 'sent', 'cancelled', 'failed');

create table public.scheduled_sends (
  id uuid primary key default gen_random_uuid(),

  kind public.scheduled_send_kind not null,
  -- Sem `references`: aponta para tabelas diferentes conforme o `kind`
  -- (`campaigns` ou, amanhã, `mail_messages`). Uma chave estrangeira
  -- polimórfica não existe em Postgres, e inventar duas colunas nulas — uma por
  -- destino — era pior: o `check` que garantisse "uma e só uma preenchida"
  -- passava a ser a definição da tabela.
  ref_id uuid not null,

  send_at timestamptz not null,
  status public.scheduled_send_status not null default 'scheduled',

  -- Quem agendou, para o registo. Nulo num agendamento criado pelo sistema.
  created_by uuid references public.profiles (id) on delete set null,

  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  fired_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.scheduled_sends is
  'P10-09 · 05 §1.9: o que está agendado para sair e quando. Disparado por pg_cron e pelo mail-worker — ver a nota de topo de 20261015160000.';

-- **Um agendamento activo por referência**, e não um por linha: agendar a mesma
-- campanha duas vezes é um erro de utilização, e um índice único é a única
-- forma de o impedir sem uma transação a verificar primeiro.
create unique index scheduled_sends_active_uidx
  on public.scheduled_sends (kind, ref_id)
  where status = 'scheduled';

-- O índice do disparo: só as que estão à espera, por ordem de hora.
create index scheduled_sends_due_idx
  on public.scheduled_sends (send_at)
  where status = 'scheduled';

create trigger scheduled_sends_set_updated_at
  before update on public.scheduled_sends
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — leitura do Marketing, escrita por função
--
-- Como as quatro tabelas das campanhas: o Marketing lê o que agendou, e nada é
-- escrito por policy. Um `direct` do Suporte, quando existir, vai precisar de
-- uma policy própria — e vai entrar com o ecrã que a justifique, não antes.
-- ---------------------------------------------------------------------------

alter table public.scheduled_sends enable row level security;

create policy scheduled_sends_marketing_select on public.scheduled_sends
  for select using (public.is_marketing());

-- ---------------------------------------------------------------------------
-- campaign_start_sending — o núcleo, sem verificação de papel
--
-- Isto é o corpo do que `campaign_send_now()` fazia em `20261015140000`, e sai
-- para função própria por uma razão concreta: **o disparo agendado não tem
-- utilizador**. `scheduled_sends_run()` corre no `pg_cron` ou no worker, onde
-- `is_marketing()` é falso, e a alternativa era uma segunda cópia das mesmas
-- quatro verificações — que divergiria da primeira no dia em que uma delas
-- mudasse.
--
-- O guarda passa a estar onde pertence: no `grant`. Esta função é da
-- `service_role`; `campaign_send_now()` fica como o invólucro do Marketing, com
-- `is_marketing()` e mais nada.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_start_sending(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.campaign_status;
  v_sender uuid;
  v_incompletos integer;
  v_first uuid;
  v_count integer;
begin
  select status, from_mailbox_id into v_status, v_sender
    from public.campaigns where id = p_id;

  if not found then
    raise exception 'Esta campanha já não existe.' using errcode = 'P0002';
  end if;
  if v_status in ('sending', 'sent') then
    raise exception 'Esta campanha já saiu.' using errcode = '42501';
  end if;
  if v_sender is null then
    raise exception 'Escolha o remetente antes de enviar.' using errcode = '22023';
  end if;

  select count(*) into v_incompletos
    from public.campaign_emails
   where campaign_id = p_id
     and (length(btrim(subject)) = 0 or jsonb_array_length(blocks) = 0);

  if v_incompletos > 0 then
    raise exception 'Há e-mails na sequência sem assunto ou sem blocos.' using errcode = '22023';
  end if;

  select id into v_first
    from public.campaign_emails where campaign_id = p_id order by position limit 1;

  if v_first is null then
    raise exception 'Esta campanha não tem e-mails.' using errcode = '22023';
  end if;

  v_count := public.campaign_materialize_recipients(v_first);

  if v_count = 0 then
    update public.campaign_emails set materialized_at = null where id = v_first;
    raise exception 'Esta audiência não tem ninguém com consentimento de marketing.'
      using errcode = '22023';
  end if;

  update public.campaigns set status = 'sending' where id = p_id;

  return v_count;
end;
$$;

comment on function public.campaign_start_sending(uuid) is
  'P10-09: o núcleo do envio, sem verificação de papel — chamado pelo invólucro do Marketing e pelo disparo agendado, que não tem utilizador.';

revoke all on function public.campaign_start_sending(uuid) from public, anon, authenticated;
grant execute on function public.campaign_start_sending(uuid) to service_role;

-- `campaign_send_now()` passa a ser o invólucro: verifica o papel e delega.
create or replace function public.campaign_send_now(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing envia campanhas.' using errcode = '42501';
  end if;

  -- Cancela um agendamento pendente desta campanha: enviar agora uma campanha
  -- agendada para amanhã não pode deixar o disparo de amanhã de pé, ou ela
  -- tentava sair uma segunda vez (e `campaign_start_sending` recusava, mas o
  -- agendamento ficava `failed` por uma razão que não era uma falha).
  update public.scheduled_sends
     set status = 'cancelled'
   where kind = 'campaign_email' and ref_id = p_id and status = 'scheduled';

  return public.campaign_start_sending(p_id);
end;
$$;

comment on function public.campaign_send_now(uuid) is
  'P10-08, alargada em P10-09: o invólucro do Marketing. Cancela o agendamento pendente e delega em campaign_start_sending().';

-- ---------------------------------------------------------------------------
-- campaign_schedule / campaign_unschedule — passam a criar e cancelar o disparo
--
-- O corpo é o de `20261015140000` mais a linha de `scheduled_sends`. A validação
-- fica: agendar uma campanha com um e-mail vazio é marcar data para um envio em
-- branco, e o momento de o dizer continua a ser agora.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_schedule(p_id uuid, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.campaign_status;
  v_incompletos integer;
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing agenda campanhas.' using errcode = '42501';
  end if;

  if p_at is null then
    raise exception 'Uma campanha agendada tem de ter data.' using errcode = '22023';
  end if;
  if p_at <= now() then
    raise exception 'A data de agendamento tem de ser no futuro.' using errcode = '22023';
  end if;

  select status into v_status from public.campaigns where id = p_id;
  if not found then
    raise exception 'Esta campanha já não existe.' using errcode = 'P0002';
  end if;
  if v_status in ('sending', 'sent') then
    raise exception 'Esta campanha já saiu.' using errcode = '42501';
  end if;

  select count(*) into v_incompletos
    from public.campaign_emails
   where campaign_id = p_id
     and (length(btrim(subject)) = 0 or jsonb_array_length(blocks) = 0);

  if v_incompletos > 0 then
    raise exception 'Há e-mails na sequência sem assunto ou sem blocos.' using errcode = '22023';
  end if;

  update public.campaigns
     set status = 'scheduled', scheduled_at = p_at
   where id = p_id;

  -- Reagendar é mudar a hora do disparo que já existe, e não criar um segundo:
  -- é o que o índice único parcial garante, e o `on conflict` é o que torna
  -- isso uma operação e não um erro.
  insert into public.scheduled_sends (kind, ref_id, send_at, created_by)
  values ('campaign_email', p_id, p_at, auth.uid())
  on conflict (kind, ref_id) where status = 'scheduled'
  do update set send_at = excluded.send_at,
                created_by = excluded.created_by,
                attempts = 0,
                last_error = null;
end;
$$;

comment on function public.campaign_schedule(uuid, timestamptz) is
  'P10-08, completa em P10-09: põe estado, data e o disparo em scheduled_sends. Reagendar muda a hora do disparo existente.';

create or replace function public.campaign_unschedule(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.campaign_status;
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing agenda campanhas.' using errcode = '42501';
  end if;

  select status into v_status from public.campaigns where id = p_id;
  if not found then
    raise exception 'Esta campanha já não existe.' using errcode = 'P0002';
  end if;
  if v_status <> 'scheduled' then
    raise exception 'Esta campanha não está agendada.' using errcode = '42501';
  end if;

  update public.campaigns
     set status = 'draft', scheduled_at = null
   where id = p_id;

  -- `cancelled` e não `delete`: o rasto de que esteve agendada para uma hora
  -- que passou é precisamente o que a campanha, sozinha, deixa de poder dizer.
  update public.scheduled_sends
     set status = 'cancelled'
   where kind = 'campaign_email' and ref_id = p_id and status = 'scheduled';
end;
$$;

comment on function public.campaign_unschedule(uuid) is
  'P10-08, completa em P10-09: devolve ao rascunho e cancela o disparo — que fica como `cancelled`, não apagado.';

-- ---------------------------------------------------------------------------
-- scheduled_sends_run — o disparo
--
-- Reclama cada linha vencida com `for update skip locked` e trata-a; os dois
-- motores (pg_cron e worker) a correrem ao mesmo tempo repartem a fila em vez
-- de disparar o mesmo envio duas vezes.
--
-- **Uma falha não volta à fila para sempre.** Três tentativas e fica `failed`
-- com o motivo: as razões por que um envio agendado falha — não há remetente,
-- um e-mail da sequência está vazio, a audiência deu zero — não melhoram por
-- serem tentadas de minuto a minuto, e a campanha fica em `scheduled` à espera
-- de quem a corrija. Três e não cinco como na fila de saída, de propósito: ali
-- o que falha é a rede, aqui o que falha é o conteúdo.
--
-- O `exception when others` por linha é o que impede que uma campanha mal
-- configurada bloqueie o disparo de todas as outras que vencem no mesmo minuto.
-- ---------------------------------------------------------------------------

create or replace function public.scheduled_sends_run(p_limit integer default 20)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linha record;
  v_feitos integer := 0;
begin
  for v_linha in
    select s.id, s.kind, s.ref_id, s.attempts
      from public.scheduled_sends s
     where s.status = 'scheduled'
       and s.send_at <= now()
     order by s.send_at
     limit greatest(coalesce(p_limit, 20), 1)
     for update skip locked
  loop
    begin
      if v_linha.kind = 'campaign_email' then
        perform public.campaign_start_sending(v_linha.ref_id);
      else
        -- `direct` ainda não tem produtor (ver a nota do enum). Se aparecer uma
        -- linha destas, é um erro de quem a escreveu e não um envio a perder-se
        -- em silêncio.
        raise exception 'Agendamento de tipo `direct` ainda não tem executor.'
          using errcode = '0A000';
      end if;

      update public.scheduled_sends
         set status = 'sent', fired_at = now(), attempts = v_linha.attempts + 1,
             last_error = null
       where id = v_linha.id;

      v_feitos := v_feitos + 1;

    exception when others then
      update public.scheduled_sends
         set status = case when v_linha.attempts + 1 >= 3
                           then 'failed'::public.scheduled_send_status
                           else 'scheduled'::public.scheduled_send_status end,
             attempts = v_linha.attempts + 1,
             last_error = left(sqlerrm, 500)
       where id = v_linha.id;
    end;
  end loop;

  return v_feitos;
end;
$$;

comment on function public.scheduled_sends_run(integer) is
  'P10-09: dispara o que venceu. Idempotente e reclamada com skip locked — pg_cron e mail-worker podem correr ao mesmo tempo.';

revoke all on function public.scheduled_sends_run(integer) from public, anon, authenticated;
grant execute on function public.scheduled_sends_run(integer) to service_role;

-- ---------------------------------------------------------------------------
-- O `pg_cron`, com a mesma guarda de `20260929120100`
--
-- Se a extensão não estiver disponível no ambiente, a migração continua e a
-- função fica igual — chamável pelo worker e pelos testes. O que se perde é só
-- o agendamento automático dentro do Postgres.
--
-- De minuto a minuto: é a granularidade que um `datetime-local` no ecrã
-- promete. Agendar para as 9h00 e sair às 9h05 é uma promessa quebrada por
-- cinco minutos sem razão nenhuma.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.schedule(
      'upm-scheduled-sends', '* * * * *',
      'select public.scheduled_sends_run()'
    );
  end if;
end;
$$;
