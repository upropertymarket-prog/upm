-- ---------------------------------------------------------------------------
-- Auditoria uniforme das ações de staff (12 §9.2 · §25 A8)
-- ---------------------------------------------------------------------------
-- Até hoje a auditoria era **por área**: cada ação de staff decidia se
-- escrevia em `audit_log`, e como. O inventário de 2 nov (68 server actions do
-- `interno`) contou 16 que auditavam de forma visível, 11 que escreviam na base
-- sem deixar rasto nenhum — contratos, 2FA, PIN, o anexo levado para a Cloud —
-- e 41 que passavam por helpers onde só lendo cada um se sabia. Uma auditoria
-- em que é preciso ler o código para saber se uma ação ficou registada não
-- responde à pergunta que existe para responder: "quem mudou isto, e quando".
--
-- Esta migração muda o sítio da garantia: da disciplina de cada ação para a
-- base de dados, por onde todos os caminhos passam.
--
-- ## 1. Append-only a sério
--
-- `audit_log` e `personal_data_access_log` não tinham policy de `update` nem
-- de `delete` — o que fecha a porta às sessões, mas não à `service_role`, que
-- não passa por RLS. Um trigger fecha-a para todos, `service_role` incluída,
-- com duas exceções e só duas:
--
--   * **a purga de retenção** (A7): `purge_audit_log` e
--     `purge_personal_data_access_log` ligam `upm.retention_purge` só dentro
--     da sua transação. A variável não se alcança pela API — o PostgREST não
--     expõe `set_config` —, por isso quem tem a chave de serviço não a liga;
--   * **o `on delete set null` do autor** (`audit_log.actor_id`), quando uma
--     conta é apagada: a linha fica, perde o nome. É a pseudonimização que o
--     RGPD pede, e sem ela apagar uma conta falhava.
--
-- O que isto **não** trava: quem tiver a palavra-passe do Postgres pode
-- desligar o trigger. É o limite de qualquer controlo dentro da base; o
-- remédio é a cópia externa da C2, não mais código aqui.
--
-- ## 2. Uniforme por construção
--
-- `audit_staff_write()` corre depois de cada `insert`/`update`/`delete` nas
-- tabelas que o staff altera, e escreve uma linha **quando quem escreve é da
-- equipa** (`is_internal()`: admin, suporte, marketing). Vale para a ação que
-- existe hoje e para a que for escrita amanhã sem ninguém se lembrar da
-- auditoria — é essa a diferença entre uniforme e disciplinado.
--
-- Guarda **os nomes das colunas que mudaram**, não os valores. Os valores de
-- `profiles`, `staff_auth` ou `campaigns` são dados pessoais ou segredos, e
-- copiá-los para um registo de 24 meses seria criar a fuga que a auditoria
-- existe para detetar. "O admin X mudou `role` e `status` do perfil Y às 14h"
-- responde ao "quem e quando"; o "de quê para quê" fica nas tabelas próprias
-- de cada área, onde já existia (moderação, leads, tickets, planos).
--
-- Fica de fora o que escreve sem sessão de staff — o worker do correio, o
-- webhook do Stripe, o pg_cron —, porque aí `auth.uid()` é null e não há
-- pessoa a quem atribuir. Dos três ficheiros do `interno` com `service_role`,
-- os planos já auditam à mão; entrar e step-up são autenticação e deixam rasto
-- em `auth_attempts`.
--
-- ## 3. As leituras que a §9.2 nomeia
--
-- Um trigger não vê leituras. "Ver dados de um utilizador" já tinha registo
-- (`record_personal_data_access`); faltavam "abrir caixa de e-mail" e
-- "exportar". `record_staff_read()` escreve-as, com a mesma janela de 15
-- minutos de `record_personal_data_access`, para que recarregar a página não
-- encha a tabela.
-- ---------------------------------------------------------------------------

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. append-only
-- ---------------------------------------------------------------------------

create or replace function public.audit_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_col text := tg_argv[0];
begin
  if coalesce(current_setting('upm.retention_purge', true), '') = 'on' then
    if tg_level = 'STATEMENT' then
      return null;
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- O `set null` do autor quando a conta é apagada: só essa coluna muda, e
  -- muda para null. Qualquer outra diferença é uma reescrita, e recusa-se.
  if tg_op = 'UPDATE' and v_actor_col is not null
     and (to_jsonb(new) ->> v_actor_col) is null
     and (to_jsonb(old) - v_actor_col) = (to_jsonb(new) - v_actor_col) then
    return new;
  end if;

  raise exception 'O registo de auditoria é só de acrescentar: % recusado em %.',
    tg_op, tg_table_name
    using errcode = '42501', hint = 'audit_append_only';
end;
$$;

revoke all on function public.audit_append_only() from public, anon, authenticated;

comment on function public.audit_append_only() is
  'A8: recusa update/delete/truncate nas tabelas de auditoria, para todos os papéis. Exceções: a purga de retenção e o set null do autor.';

drop trigger if exists audit_log_append_only on public.audit_log;
create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.audit_append_only('actor_id');

drop trigger if exists audit_log_append_only_truncate on public.audit_log;
create trigger audit_log_append_only_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_append_only();

-- `actor_profile_id` é `on delete restrict`: não há `set null` a deixar passar.
drop trigger if exists personal_data_access_log_append_only on public.personal_data_access_log;
create trigger personal_data_access_log_append_only
  before update or delete on public.personal_data_access_log
  for each row execute function public.audit_append_only();

drop trigger if exists personal_data_access_log_append_only_truncate on public.personal_data_access_log;
create trigger personal_data_access_log_append_only_truncate
  before truncate on public.personal_data_access_log
  for each statement execute function public.audit_append_only();

-- ---------------------------------------------------------------------------
-- As purgas passam a abrir a porta — e a fechá-la logo a seguir
--
-- `set_config(..., true)` vale até ao fim da transação. Como o `run_retention`
-- corre todas as purgas na mesma transação, cada uma volta a pôr `off` mal
-- acaba: a exceção dura um `delete`, não uma noite.
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
  perform set_config('upm.retention_purge', 'on', true);

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

  perform set_config('upm.retention_purge', 'off', true);
  return v_count;
end;
$$;

revoke all on function public.purge_audit_log() from public, anon, authenticated;
grant execute on function public.purge_audit_log() to service_role;

-- O job de 20261002130000 fazia um `delete` cru, que o trigger agora recusa.
-- Passa a função, com o mesmo prazo (2 anos, 07 §13.6), e entra no
-- orquestrador do A7 — onde uma falha fica escrita em vez de calada.
create or replace function public.purge_personal_data_access_log()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform set_config('upm.retention_purge', 'on', true);

  delete from public.personal_data_access_log l
   where l.occurred_at < now() - interval '2 years';
  get diagnostics v_count = row_count;

  perform set_config('upm.retention_purge', 'off', true);
  return v_count;
end;
$$;

revoke all on function public.purge_personal_data_access_log() from public, anon, authenticated;
grant execute on function public.purge_personal_data_access_log() to service_role;

comment on function public.purge_personal_data_access_log() is
  'A7/A8: apaga consultas a dados pessoais com mais de 2 anos (07 §13.6). Corre pelo run_retention.';

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
    'purge_audit_log',
    'purge_personal_data_access_log'
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
        when 'purge_personal_data_access_log' then v_n := public.purge_personal_data_access_log();
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

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-personal-data-access-log') then
      perform cron.unschedule('purge-personal-data-access-log');
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. audit_staff_write — toda a escrita de staff deixa rasto
-- ---------------------------------------------------------------------------

create or replace function public.audit_staff_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_new jsonb;
  v_old jsonb;
  v_row jsonb;
  v_changed text[];
  v_id text;
  v_entity_id uuid;
  v_diff jsonb;
begin
  -- Sem pessoa da equipa, não há a quem atribuir: worker, webhook, cron, ou o
  -- próprio cliente a mexer no que é seu.
  if v_actor is null or not public.is_internal() then
    return null;
  end if;

  v_new := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row := coalesce(v_new, v_old);

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}')
      into v_changed
      from jsonb_object_keys(v_new) as k
     where k not in ('updated_at', 'created_at')
       and (v_new -> k) is distinct from (v_old -> k);

    -- Um `update` que não mudou nada (só o `updated_at`) não é uma ação.
    if cardinality(v_changed) = 0 then
      return null;
    end if;
  end if;

  -- `audit_log.entity_id` é uuid. As tabelas de chave textual (`app_settings`,
  -- `feature_flags`) identificam-se pela chave, dentro do `diff`.
  v_id := v_row ->> 'id';
  if v_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_entity_id := v_id::uuid;
  end if;

  v_diff := jsonb_build_object('op', lower(tg_op), 'via', 'trigger');
  if v_changed is not null then
    v_diff := v_diff || jsonb_build_object('changed', to_jsonb(v_changed));
  end if;
  if v_entity_id is null and v_row ? 'key' then
    v_diff := v_diff || jsonb_build_object('key', v_row ->> 'key');
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, diff)
  values (v_actor, tg_table_name || '.' || lower(tg_op), tg_table_name, v_entity_id, v_diff);

  return null;
end;
$$;

revoke all on function public.audit_staff_write() from public, anon, authenticated;

comment on function public.audit_staff_write() is
  'A8: regista em audit_log toda a escrita feita com sessão de staff (is_internal). Guarda os nomes das colunas mudadas, nunca os valores.';

-- As tabelas que o staff altera: as que têm policy de escrita para um papel de
-- staff (lidas de pg_policies a 2 nov) e as que só mudam por RPC chamada pelo
-- staff. `mail_messages` fica de fora de propósito: marcar como lida ou mover
-- de pasta é o trabalho de cada minuto do Suporte, e o que importa saber —
-- quem abriu a caixa — regista-o `record_staff_read`.
--
-- Tabela nova que o staff escreva ⇒ acrescentar aqui. `retention.test.ts`
-- verifica que a lista não perde nenhuma das que tem hoje.

drop trigger if exists addons_audit_staff on public.addons;
create trigger addons_audit_staff after insert or update or delete on public.addons
  for each row execute function public.audit_staff_write();

drop trigger if exists app_settings_audit_staff on public.app_settings;
create trigger app_settings_audit_staff after insert or update or delete on public.app_settings
  for each row execute function public.audit_staff_write();

drop trigger if exists app_updates_audit_staff on public.app_updates;
create trigger app_updates_audit_staff after insert or update or delete on public.app_updates
  for each row execute function public.audit_staff_write();

drop trigger if exists campaign_emails_audit_staff on public.campaign_emails;
create trigger campaign_emails_audit_staff after insert or update or delete on public.campaign_emails
  for each row execute function public.audit_staff_write();

drop trigger if exists campaigns_audit_staff on public.campaigns;
create trigger campaigns_audit_staff after insert or update or delete on public.campaigns
  for each row execute function public.audit_staff_write();

drop trigger if exists contract_templates_audit_staff on public.contract_templates;
create trigger contract_templates_audit_staff after insert or update or delete on public.contract_templates
  for each row execute function public.audit_staff_write();

drop trigger if exists email_signatures_audit_staff on public.email_signatures;
create trigger email_signatures_audit_staff after insert or update or delete on public.email_signatures
  for each row execute function public.audit_staff_write();

drop trigger if exists feature_flags_audit_staff on public.feature_flags;
create trigger feature_flags_audit_staff after insert or update or delete on public.feature_flags
  for each row execute function public.audit_staff_write();

drop trigger if exists files_audit_staff on public.files;
create trigger files_audit_staff after insert or update or delete on public.files
  for each row execute function public.audit_staff_write();

drop trigger if exists folders_audit_staff on public.folders;
create trigger folders_audit_staff after insert or update or delete on public.folders
  for each row execute function public.audit_staff_write();

drop trigger if exists legal_documents_audit_staff on public.legal_documents;
create trigger legal_documents_audit_staff after insert or update or delete on public.legal_documents
  for each row execute function public.audit_staff_write();

drop trigger if exists mail_labels_audit_staff on public.mail_labels;
create trigger mail_labels_audit_staff after insert or update or delete on public.mail_labels
  for each row execute function public.audit_staff_write();

drop trigger if exists mailboxes_audit_staff on public.mailboxes;
create trigger mailboxes_audit_staff after insert or update or delete on public.mailboxes
  for each row execute function public.audit_staff_write();

drop trigger if exists message_templates_audit_staff on public.message_templates;
create trigger message_templates_audit_staff after insert or update or delete on public.message_templates
  for each row execute function public.audit_staff_write();

drop trigger if exists plans_audit_staff on public.plans;
create trigger plans_audit_staff after insert or update or delete on public.plans
  for each row execute function public.audit_staff_write();

drop trigger if exists profiles_audit_staff on public.profiles;
create trigger profiles_audit_staff after insert or update or delete on public.profiles
  for each row execute function public.audit_staff_write();

drop trigger if exists properties_audit_staff on public.properties;
create trigger properties_audit_staff after insert or update or delete on public.properties
  for each row execute function public.audit_staff_write();

drop trigger if exists property_documents_audit_staff on public.property_documents;
create trigger property_documents_audit_staff after insert or update or delete on public.property_documents
  for each row execute function public.audit_staff_write();

drop trigger if exists property_media_audit_staff on public.property_media;
create trigger property_media_audit_staff after insert or update or delete on public.property_media
  for each row execute function public.audit_staff_write();

drop trigger if exists scheduled_sends_audit_staff on public.scheduled_sends;
create trigger scheduled_sends_audit_staff after insert or update or delete on public.scheduled_sends
  for each row execute function public.audit_staff_write();

drop trigger if exists seo_pages_audit_staff on public.seo_pages;
create trigger seo_pages_audit_staff after insert or update or delete on public.seo_pages
  for each row execute function public.audit_staff_write();

drop trigger if exists site_leads_audit_staff on public.site_leads;
create trigger site_leads_audit_staff after insert or update or delete on public.site_leads
  for each row execute function public.audit_staff_write();

drop trigger if exists staff_auth_audit_staff on public.staff_auth;
create trigger staff_auth_audit_staff after insert or update or delete on public.staff_auth
  for each row execute function public.audit_staff_write();

drop trigger if exists staff_members_audit_staff on public.staff_members;
create trigger staff_members_audit_staff after insert or update or delete on public.staff_members
  for each row execute function public.audit_staff_write();

drop trigger if exists subscription_addons_audit_staff on public.subscription_addons;
create trigger subscription_addons_audit_staff after insert or update or delete on public.subscription_addons
  for each row execute function public.audit_staff_write();

drop trigger if exists subscriptions_audit_staff on public.subscriptions;
create trigger subscriptions_audit_staff after insert or update or delete on public.subscriptions
  for each row execute function public.audit_staff_write();

drop trigger if exists tickets_audit_staff on public.tickets;
create trigger tickets_audit_staff after insert or update or delete on public.tickets
  for each row execute function public.audit_staff_write();

drop trigger if exists trial_extension_requests_audit_staff on public.trial_extension_requests;
create trigger trial_extension_requests_audit_staff after insert or update or delete on public.trial_extension_requests
  for each row execute function public.audit_staff_write();

-- ---------------------------------------------------------------------------
-- 3. record_staff_read — as leituras que importam
-- ---------------------------------------------------------------------------

create or replace function public.record_staff_read(
  p_action text,
  p_entity text,
  p_entity_id uuid default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.is_internal() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  -- Uma lista fechada, e não um texto livre: uma leitura registada com um
  -- nome inventado na hora não se encontra quando é preciso procurá-la.
  if p_action not in ('mailbox.opened', 'report.exported') then
    raise exception 'Leitura não prevista: %', p_action using errcode = '22023';
  end if;
  if coalesce(btrim(p_entity), '') = '' or length(p_entity) > 80 then
    raise exception 'entity inválida' using errcode = '22023';
  end if;

  -- A mesma janela de `record_personal_data_access`: recarregar a página, ou
  -- abrir a mesma caixa dez vezes numa manhã, é uma consulta e não dez.
  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || ':' || p_action || ':' || coalesce(p_entity_id::text, ''), 0)
  );

  if exists (
    select 1
      from public.audit_log a
     where a.actor_id = v_actor
       and a.action = p_action
       and a.entity_id is not distinct from p_entity_id
       and a.created_at > now() - interval '15 minutes'
  ) then
    return false;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, diff)
  values (v_actor, p_action, btrim(p_entity), p_entity_id, jsonb_build_object('via', 'read'));
  return true;
end;
$$;

revoke all on function public.record_staff_read(text, text, uuid) from public, anon;
grant execute on function public.record_staff_read(text, text, uuid) to authenticated;

comment on function public.record_staff_read(text, text, uuid) is
  'A8: regista leituras de staff que a §9.2 nomeia (abrir caixa de e-mail, exportar), com janela de 15 minutos.';
