-- ---------------------------------------------------------------------------
-- Retenção por tabela (12 §14 #2 · §25 A7) — RGPD, art. 5.º(1)(e)
-- ---------------------------------------------------------------------------
-- A limitação da conservação diz que um dado pessoal só se guarda "durante o
-- período necessário para as finalidades para as quais são tratados". Guardar
-- para sempre não é neutro: é incumprimento, e é também o que uma violação de
-- dados leva consigo. Cada linha que já não serve para nada é uma linha que
-- não pode ser roubada.
--
-- Esta migração não começa do zero. Antes dela já havia oito purgas
-- agendadas, e ficam como estão:
--
-- | Job pg_cron                         | Tabela                    | Prazo     |
-- | ----------------------------------- | ------------------------- | --------- |
-- | upm-purge-property-view-events      | property_view_events      | 90 dias   |
-- | upm-purge-unconfirmed-site-leads    | site_leads não confirmados| 30 dias   |
-- | upm-purge-ticket-technical-data     | tickets (dados técnicos)  | app_settings, 90 |
-- | upm-purge-document-access-log       | document_access_log       | (Fase 6)  |
-- | upm-purge-cloud-recycle-bin         | lixo da Cloud             | (Fase 6)  |
-- | purge-personal-data-access-log      | personal_data_access_log  | 2 anos    |
-- | upm-purge-site-analytics            | site_analytics_daily      | 26 meses  |
-- | (mail-worker, não pg_cron)          | anexos de e-mail          | app_settings, 180 |
--
-- ## O que esta migração acrescenta
--
-- | Função                              | Tabela                         | Prazo      |
-- | ----------------------------------- | ------------------------------ | ---------- |
-- | purge_stale_site_leads              | site_leads não convertidos     | 12 meses após a última interação |
-- | purge_notification_deliveries       | notification_deliveries        | 90 dias    |
-- | purge_auth_attempts                 | auth_attempts                  | 90 dias    |
-- | purge_audit_log                     | audit_log (fora da faturação)  | 24 meses   |
-- | purge_mail_messages                 | mail_messages (+ fios vazios)  | 24 meses   |
-- | purge_deleted_account_residue       | resíduos de contas eliminadas  | 30 dias após a eliminação |
--
-- Todas correm por um orquestrador, `run_retention()`, num só job diário.
--
-- ## Duas suposições do pedido que a leitura do esquema corrigiu
--
--   * **`property_views` não é analítica em bruto.** É uma linha por imóvel e
--     por dia com um contador — não tem quem viu, não é dado pessoal, e é um
--     agregado: fica. O bruto é `property_view_events`, que já tinha purga de
--     90 dias desde a Fase 7.
--   * **Não há "tráfego" em bruto na base de dados.** `site_analytics_daily`
--     é já um agregado diário (26 meses, 07 §21.6), e a privacidade v3 diz-o:
--     "não contêm dados pessoais". Não há nada para purgar aos 90 dias.
--
-- ## O que NÃO se apaga, e porquê — o engano mais caro deste item
--
-- `invoices` e o que sustenta a faturação (`subscriptions`,
-- `subscription_events`, `subscription_agreements`, `subscription_addons`,
-- `stripe_events`) têm conservação **mínima** legal de 10 anos (Código
-- Comercial, art. 40.º; CIVA, art. 52.º). Apagá-los não é "cumprir o RGPD": é
-- violar a lei fiscal, e o RGPD cede expressamente perante uma obrigação legal
-- (art. 17.º(3)(b)). O mesmo para `terms_acceptances` — é a prova do contrato.
-- Nenhuma função daqui lhes toca, e `packages/db/src/retention.test.ts` recusa
-- qualquer migração que lhes faça `delete` ou `truncate`.
--
-- Também ficam, por razões diferentes:
--   * `email_suppressions` — apagar a lista de quem pediu para não receber
--     e-mail é a forma mais rápida de lhe voltar a enviar;
--   * `account_deletions` — é o registo de que o pedido de apagamento foi
--     cumprido (art. 5.º(2), responsabilidade). Perde o texto livre, não a linha;
--   * `person_identities` — o prazo destes hashes depende da base legal que o
--     jurista ainda não validou (`account_deletion_retention_months` continua
--     a null, de propósito — P9-06). Não se inventa um prazo aqui.
--
-- ## Porquê prazos escritos no SQL e não em `app_settings`
--
-- Os dados técnicos dos tickets e os anexos de e-mail leem o prazo de
-- `app_settings`, editável pelo Admin. Para estes não: um prazo de retenção do
-- `audit_log` que se baixa de um ecrã é um botão para apagar a auditoria. Um
-- prazo que muda numa migração muda num PR, revisto, com histórico.
--
-- ## A purga é a única exceção ao append-only
--
-- `audit_log` e `site_lead_events` não têm policy de `delete` e não vão ter.
-- As funções daqui são `security definer`, sem `grant` a sessão nenhuma: só a
-- `service_role` e o pg_cron as chamam. Quando A8 tornar a auditoria imutável
-- também para a `service_role` (trigger de recusa), esse trigger tem de deixar
-- passar `purge_audit_log` — senão a retenção para sem ninguém dar por isso.
-- ---------------------------------------------------------------------------

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Índices para as purgas
--
-- Cada purga filtra por uma data que, nestas tabelas, não era coluna inicial
-- de índice nenhum: `auth_attempts` só tinha (identifier, kind, created_at), o
-- de `notification_deliveries` é parcial (`status = 'queued'`) e o de
-- `audit_log` é parcial por ação. Sem eles, cada noite era uma leitura
-- sequencial das tabelas que mais crescem — `auth_attempts` leva uma linha por
-- tentativa de entrada.
-- ---------------------------------------------------------------------------

create index if not exists auth_attempts_created_idx
  on public.auth_attempts (created_at);
create index if not exists notification_deliveries_created_idx
  on public.notification_deliveries (created_at);
create index if not exists audit_log_created_idx
  on public.audit_log (created_at);
create index if not exists mail_messages_received_idx
  on public.mail_messages (received_at);
create index if not exists account_deletions_completed_idx
  on public.account_deletions (completed_at)
  where completed_at is not null;

-- Marca de que os resíduos de uma eliminação já foram purgados. Sem ela, a
-- purga voltava a cada conta eliminada todas as noites, para sempre; e a
-- resposta a "quando foi apagado o resto?" ficava sem data.
alter table public.account_deletions
  add column if not exists residue_purged_at timestamptz;

comment on column public.account_deletions.residue_purged_at is
  'Quando os resíduos identificáveis foram purgados (A7, 30 dias após a eliminação).';

-- ---------------------------------------------------------------------------
-- purge_unconfirmed_site_leads — corrigida
--
-- A versão de 7 out tinha um defeito que a fazia falhar em silêncio:
-- `site_lead_events.lead_id` é `on delete restrict`. Bastava o Admin ter
-- mudado o estado ou atribuído **um** lead não confirmado com mais de 30 dias
-- para o `delete` inteiro rebentar — e com ele a purga de todos os outros,
-- todas as noites, até alguém ler `cron.job_run_details`. Agora apagam-se
-- primeiro os eventos desses leads, na mesma transação.
--
-- Passa também a `search_path = ''` e perde o `execute` do `authenticated`:
-- o `revoke ... from public, anon` original deixava-o, pelos privilégios por
-- omissão do Supabase, a qualquer sessão autenticada.
-- ---------------------------------------------------------------------------

create or replace function public.purge_unconfirmed_site_leads()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_count integer;
begin
  select coalesce(array_agg(l.id), '{}')
    into v_ids
    from public.site_leads l
   where l.confirmed_at is null
     and l.created_at < now() - interval '30 days';

  delete from public.site_lead_events e where e.lead_id = any (v_ids);
  delete from public.site_leads l where l.id = any (v_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_unconfirmed_site_leads() from public, anon, authenticated;
grant execute on function public.purge_unconfirmed_site_leads() to service_role;

-- ---------------------------------------------------------------------------
-- purge_stale_site_leads — 12 meses após a última interação
--
-- Um lead não convertido é alguém que nos deu o contacto para uma conversa que
-- não deu em nada. Doze meses depois do último sinal, a finalidade acabou.
--
-- "Última interação" é a mais recente de quatro datas: a criação, a
-- confirmação, o último `updated_at` (que o trigger mexe a cada mudança de
-- estado, atribuição ou consentimento — inclusive o cancelamento de subscrição
-- vindo do Resend) e o último evento em `site_lead_events`. Contar só com
-- `created_at` apagava um lead com quem se falou ontem.
--
-- Os `converted` ficam: passaram a cliente, e a relação continua noutro sítio
-- (contrato, subscrição) com a sua própria base legal. Os `discarded` saem
-- pela mesma regra — descartar é decidir que não há finalidade, não que há.
-- ---------------------------------------------------------------------------

create or replace function public.purge_stale_site_leads()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_count integer;
begin
  select coalesce(array_agg(l.id), '{}')
    into v_ids
    from public.site_leads l
   where l.status <> 'converted'
     and greatest(
           l.created_at,
           l.updated_at,
           coalesce(l.confirmed_at, l.created_at),
           coalesce(
             (select max(e.created_at) from public.site_lead_events e where e.lead_id = l.id),
             l.created_at
           )
         ) < now() - interval '12 months';

  -- Dois passos, e não um CTE que apague as duas: com `on delete restrict` a
  -- verificação é imediata, e a ordem dos sub-comandos de um CTE não é
  -- garantida.
  delete from public.site_lead_events e where e.lead_id = any (v_ids);
  delete from public.site_leads l where l.id = any (v_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_stale_site_leads() from public, anon, authenticated;
grant execute on function public.purge_stale_site_leads() to service_role;

comment on function public.purge_stale_site_leads() is
  'A7: apaga leads não convertidos 12 meses após a última interação, com os seus eventos.';

-- ---------------------------------------------------------------------------
-- purge_notification_deliveries — 90 dias
--
-- Cada linha leva o endereço de e-mail do destinatário e o `payload` com o
-- que lhe dissemos. Serve para o worker enviar e para o Admin responder a "não
-- recebi o e-mail" — pergunta que ninguém faz três meses depois. Pelo estado
-- não se filtra: uma entrega ainda `queued` ao fim de 90 dias está morta, e o
-- índice de agrupamento só olha para as `queued`, logo apagá-la não deixa
-- reenviar nada que já tenha saído.
-- ---------------------------------------------------------------------------

create or replace function public.purge_notification_deliveries()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.notification_deliveries d
   where d.created_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_notification_deliveries() from public, anon, authenticated;
grant execute on function public.purge_notification_deliveries() to service_role;

comment on function public.purge_notification_deliveries() is
  'A7: apaga entregas de notificação com mais de 90 dias (contêm o e-mail do destinatário).';

-- ---------------------------------------------------------------------------
-- purge_auth_attempts — 90 dias
--
-- O limitador lê janelas de 15 minutos; nada no código olha para trás mais do
-- que isso. Os 90 dias não são para o limitador, são para a investigação de um
-- ataque — um credential stuffing descobre-se semanas depois, não no dia. O
-- `identifier` é um e-mail ou um IP: dado pessoal nos dois casos.
-- ---------------------------------------------------------------------------

create or replace function public.purge_auth_attempts()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.auth_attempts a
   where a.created_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_auth_attempts() from public, anon, authenticated;
grant execute on function public.purge_auth_attempts() to service_role;

comment on function public.purge_auth_attempts() is
  'A7: apaga tentativas de autenticação com mais de 90 dias (e-mail ou IP).';

-- ---------------------------------------------------------------------------
-- purge_audit_log — 24 meses, fora da faturação
--
-- 24 meses alinha com `personal_data_access_log` (2 anos, 07 §13.6): as duas
-- metades da auditoria de staff — o que mudou e o que se consultou — morrem ao
-- mesmo tempo. **Prazo a confirmar pelo jurista em E1**: é o mais discutível
-- da lista, porque uma auditoria curta demais falha a quem precisa de provar o
-- que aconteceu.
--
-- As linhas da faturação ficam. O webhook do Stripe escreve aqui cada mudança
-- de estado de uma subscrição (`stripe.subscription.*`), e o que documenta
-- faturação segue o prazo fiscal de 10 anos, não o da auditoria. A lista é de
-- entidades **e** de prefixo da ação, porque um registo sobre uma fatura pode
-- ter `entity = 'profiles'` e a ação dizê-lo.
-- ---------------------------------------------------------------------------

create or replace function public.purge_audit_log()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.audit_log a
   where a.created_at < now() - interval '24 months'
     and a.entity not in (
       'invoices', 'subscriptions', 'subscription_events',
       'subscription_addons', 'subscription_agreements', 'plans', 'addons'
     )
     and a.action not like 'stripe.%'
     and a.action not like 'billing.%'
     and a.action not like 'invoice.%'
     and a.action not like 'subscription.%';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_audit_log() from public, anon, authenticated;
grant execute on function public.purge_audit_log() to service_role;

comment on function public.purge_audit_log() is
  'A7: apaga audit_log com mais de 24 meses, exceto faturação (10 anos). Prazo a rever em E1.';

-- ---------------------------------------------------------------------------
-- purge_mail_messages — 24 meses, e os fios que ficam vazios
--
-- O correio da equipa com clientes. 24 meses cobre um ciclo de venda e uma
-- reclamação tardia; depois disso o que conta já está no ticket ou no
-- contrato.
--
-- **Uma mensagem com anexos ainda em Storage não se apaga.** Os ficheiros não
-- saem por SQL — sai o `mail-worker`, que lê `mail_attachments_expired()` e
-- só depois marca a linha com `mail_attachment_purged()`. Se a linha
-- desaparecesse primeiro, o worker deixava de saber que os ficheiros existem
-- e eles ficavam no bucket para sempre, órfãos: a forma exata de reter mais,
-- não menos. Com o prazo dos anexos a 180 dias isto não morde; morde no dia em
-- que alguém subir `mail_attachment_retention_days` acima de 730, e então a
-- mensagem espera pelos anexos em vez de os abandonar.
--
-- O `message_count` dos fios mantém-se pelo worker, por incremento; depois da
-- purga recalcula-se, e um fio sem mensagens — que leva o assunto — sai.
-- ---------------------------------------------------------------------------

create or replace function public.purge_mail_messages()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_threads uuid[];
  v_count integer;
begin
  with gone as (
    delete from public.mail_messages m
     where m.received_at < now() - interval '24 months'
       and not exists (
         select 1
           from jsonb_array_elements(m.attachments) as a(value)
          where a.value ->> 'path' is not null
       )
    returning m.thread_id
  )
  select count(*)::integer, coalesce(array_agg(distinct gone.thread_id)
                                     filter (where gone.thread_id is not null), '{}')
    into v_count, v_threads
    from gone;

  delete from public.mail_threads t
   where t.id = any (v_threads)
     and not exists (select 1 from public.mail_messages m where m.thread_id = t.id);

  update public.mail_threads t
     set message_count = (select count(*) from public.mail_messages m where m.thread_id = t.id)
   where t.id = any (v_threads);

  return v_count;
end;
$$;

revoke all on function public.purge_mail_messages() from public, anon, authenticated;
grant execute on function public.purge_mail_messages() to service_role;

comment on function public.purge_mail_messages() is
  'A7: apaga mensagens com mais de 24 meses sem anexos por purgar, e os fios vazios.';

-- ---------------------------------------------------------------------------
-- purge_deleted_account_residue — 30 dias após a eliminação
--
-- `delete_own_account()` anonimiza o perfil no momento. O que fica para trás
-- são linhas que só serviam o titular e que nenhum terceiro, nem nenhuma lei,
-- precisa: favoritos, alertas de pesquisa, notificações, entregas de e-mail
-- (com o endereço antigo), as leituras do "o que há de novo", o motivo que a
-- pessoa escreveu ao sair. Os 30 dias são a margem para um engano que o
-- Suporte ainda consiga desfazer à mão; depois disso não há volta.
--
-- `property_view_events` não se apaga: o `viewer_id` passa a null. É o que a
-- própria tabela pede ("apagar a conta não deve apagar a contagem que o
-- proprietário já viu") — o proprietário perde quem viu, não quantos viram.
--
-- **Ficam, de propósito**, e são perguntas para E1, não omissões:
--   * mensagens e conversas — a outra parte tem direito ao seu histórico;
--   * visitas, leads do proprietário, contratos — idem, e alguns são prova;
--   * ficheiros da Cloud — saem do Storage pela app, não por SQL;
--   * faturação, subscrições e aceitação de termos — obrigação legal;
--   * `person_identities` — prazo por fixar (P9-06), ver o cabeçalho.
--
-- Só se toca num perfil que esteja de facto `deleted`: se um dia houver
-- reativação, uma linha de `account_deletions` antiga não pode apagar os
-- favoritos de uma conta viva.
-- ---------------------------------------------------------------------------

create or replace function public.purge_deleted_account_residue()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_saved integer;
  v_alerts integer;
  v_notifications integer;
  v_deliveries integer;
  v_update_views integer;
  v_views integer;
  v_done integer := 0;
begin
  for v_row in
    select d.id, d.profile_id
      from public.account_deletions d
      join public.profiles p on p.id = d.profile_id
     where d.completed_at < now() - interval '30 days'
       and d.residue_purged_at is null
       and p.status = 'deleted'
     order by d.completed_at
  loop
    delete from public.saved_properties s where s.user_id = v_row.profile_id;
    get diagnostics v_saved = row_count;

    delete from public.search_alerts s where s.user_id = v_row.profile_id;
    get diagnostics v_alerts = row_count;

    -- As entregas antes das notificações, para o `set null` de
    -- `notification_id` não mexer em linhas que vão sair a seguir.
    delete from public.notification_deliveries n where n.profile_id = v_row.profile_id;
    get diagnostics v_deliveries = row_count;

    delete from public.notifications n where n.profile_id = v_row.profile_id;
    get diagnostics v_notifications = row_count;

    delete from public.app_update_views u where u.profile_id = v_row.profile_id;
    get diagnostics v_update_views = row_count;

    update public.property_view_events e
       set viewer_id = null
     where e.viewer_id = v_row.profile_id;
    get diagnostics v_views = row_count;

    -- O registo fica, com o que se purgou: a resposta a um pedido de titular
    -- não pode depender de memória de ninguém (P9-06).
    update public.account_deletions d
       set reason = null,
           residue_purged_at = now(),
           anonymized = d.anonymized || jsonb_build_object(
             'residue', jsonb_build_object(
               'saved_properties', v_saved,
               'search_alerts', v_alerts,
               'notifications', v_notifications,
               'notification_deliveries', v_deliveries,
               'app_update_views', v_update_views,
               'property_view_events_unlinked', v_views,
               'reason', true
             )
           )
     where d.id = v_row.id;

    v_done := v_done + 1;
  end loop;

  return v_done;
end;
$$;

revoke all on function public.purge_deleted_account_residue() from public, anon, authenticated;
grant execute on function public.purge_deleted_account_residue() to service_role;

comment on function public.purge_deleted_account_residue() is
  'A7: 30 dias após a eliminação, apaga o que só servia o titular. Devolve contas tratadas.';

-- ---------------------------------------------------------------------------
-- run_retention — o orquestrador
--
-- Um job e não seis, por uma razão que o defeito de `purge_unconfirmed_site_
-- leads` acima ensinou: **uma purga que falha não pode levar as outras com
-- ela, e não pode falhar calada.** Cada purga corre no seu bloco com
-- `exception`, que é uma subtransação — o erro de uma desfaz só essa — e o
-- resultado de todas, contagens e erros, fica numa linha de `audit_log`.
--
-- Essa linha é a prova, para o jurista e para uma auditoria, de que a política
-- de retenção corre e não está só escrita. E é o que o monitor de C5 deve
-- ler: nenhuma `retention.run` nas últimas 36 horas, ou uma com `errors` não
-- vazio, é um alerta.
--
-- Não se relança a exceção no fim: desfazia a linha de auditoria, que é
-- precisamente o que diz o que falhou. O erro sai como `warning` nos logs do
-- Postgres e fica escrito.
-- ---------------------------------------------------------------------------

create or replace function public.run_retention()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_errors jsonb := '{}'::jsonb;
  v_name text;
  v_n integer;
begin
  -- A ordem importa numa coisa: os resíduos das contas eliminadas primeiro,
  -- para as suas entregas saírem pelos 30 dias e não esperarem pelos 90.
  foreach v_name in array array[
    'purge_deleted_account_residue',
    'purge_stale_site_leads',
    'purge_notification_deliveries',
    'purge_auth_attempts',
    'purge_mail_messages',
    'purge_audit_log'
  ]
  loop
    begin
      case v_name
        when 'purge_deleted_account_residue' then v_n := public.purge_deleted_account_residue();
        when 'purge_stale_site_leads' then v_n := public.purge_stale_site_leads();
        when 'purge_notification_deliveries' then v_n := public.purge_notification_deliveries();
        when 'purge_auth_attempts' then v_n := public.purge_auth_attempts();
        when 'purge_mail_messages' then v_n := public.purge_mail_messages();
        when 'purge_audit_log' then v_n := public.purge_audit_log();
      end case;
      v_counts := v_counts || jsonb_build_object(v_name, v_n);
    exception when others then
      v_errors := v_errors || jsonb_build_object(v_name, sqlerrm);
      raise warning 'run_retention: % falhou: %', v_name, sqlerrm;
    end;
  end loop;

  insert into public.audit_log (actor_id, action, entity, entity_id, diff)
  values (
    null, 'retention.run', 'retention', null,
    jsonb_build_object('counts', v_counts, 'errors', v_errors)
  );

  return jsonb_build_object('counts', v_counts, 'errors', v_errors);
end;
$$;

revoke all on function public.run_retention() from public, anon, authenticated;
grant execute on function public.run_retention() to service_role;

comment on function public.run_retention() is
  'A7: corre todas as purgas de retenção, cada uma isolada, e regista o resultado em audit_log.';

-- pg_cron dentro de uma guarda, como nas fases anteriores: sem a extensão
-- (ambiente local sem ela) a migração aplica-se na mesma e as funções ficam
-- chamáveis à mão. 03:10 — antes das purgas das 03:25 em diante, fora de
-- qualquer hora de uso.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.schedule(
      'upm-run-retention', '10 3 * * *',
      'select public.run_retention()'
    );
  end if;
end;
$$;
