-- =========================================================================
-- Índices em todas as chaves estrangeiras que não os tinham (4 nov 2026)
-- =========================================================================
-- Auditoria de desempenho (12 §31). Uma chave estrangeira sem índice obriga
-- o Postgres a ler a tabela filha inteira em dois casos: quando se filtra ou
-- junta por essa coluna, e cada vez que a linha-mãe se apaga ou muda de
-- chave (a verificação da FK). Havia 34.
--
-- Hoje não pesam: as tabelas são pequenas e o planeador prefere, com razão,
-- ler tudo — medido, nenhuma leitura da app passa de 2 ms na base. Pesam
-- quando crescerem, e criar um índice numa tabela grande, em produção, é o
-- trabalho que se quer fazer agora, com elas vazias. O custo é pequeno: são
-- sobretudo colunas como `created_by`, que se escrevem uma vez.
--
-- A lista vem do catálogo, não à mão — a mesma consulta, corrida depois
-- desta migração, tem de devolver zero (`indices-fk.test.ts` vigia-o).
-- =========================================================================

create index if not exists app_updates_created_by_fk_idx on public.app_updates (created_by);
create index if not exists campaign_recipients_profile_id_fk_idx on public.campaign_recipients (profile_id);
create index if not exists campaigns_created_by_fk_idx on public.campaigns (created_by);
create index if not exists campaigns_from_mailbox_id_fk_idx on public.campaigns (from_mailbox_id);
create index if not exists contract_shares_shared_by_fk_idx on public.contract_shares (shared_by);
create index if not exists contract_shares_version_id_fk_idx on public.contract_shares (version_id);
create index if not exists contract_templates_created_by_fk_idx on public.contract_templates (created_by);
create index if not exists contract_versions_created_by_fk_idx on public.contract_versions (created_by);
create index if not exists contracts_template_id_fk_idx on public.contracts (template_id);
create index if not exists document_access_log_actor_profile_id_fk_idx on public.document_access_log (actor_profile_id);
create index if not exists email_events_recipient_id_fk_idx on public.email_events (recipient_id);
create index if not exists email_suppressions_campaign_id_fk_idx on public.email_suppressions (campaign_id);
create index if not exists file_shares_shared_by_fk_idx on public.file_shares (shared_by);
create index if not exists file_versions_created_by_fk_idx on public.file_versions (created_by);
create index if not exists folders_property_id_fk_idx on public.folders (property_id);
create index if not exists legal_documents_created_by_fk_idx on public.legal_documents (created_by);
create index if not exists message_templates_created_by_fk_idx on public.message_templates (created_by);
create index if not exists message_templates_updated_by_fk_idx on public.message_templates (updated_by);
create index if not exists messages_sender_id_fk_idx on public.messages (sender_id);
create index if not exists notification_deliveries_notification_id_fk_idx on public.notification_deliveries (notification_id);
create index if not exists property_address_grants_granted_by_fk_idx on public.property_address_grants (granted_by);
create index if not exists property_address_grants_visit_request_id_fk_idx on public.property_address_grants (visit_request_id);
create index if not exists scheduled_sends_created_by_fk_idx on public.scheduled_sends (created_by);
create index if not exists seo_pages_updated_by_fk_idx on public.seo_pages (updated_by);
create index if not exists subscription_addons_addon_id_fk_idx on public.subscription_addons (addon_id);
create index if not exists subscription_agreements_plan_id_fk_idx on public.subscription_agreements (plan_id);
create index if not exists subscription_agreements_supersedes_id_fk_idx on public.subscription_agreements (supersedes_id);
create index if not exists subscription_agreements_terms_document_id_fk_idx on public.subscription_agreements (terms_document_id);
create index if not exists subscription_events_plan_id_from_fk_idx on public.subscription_events (plan_id_from);
create index if not exists subscription_events_plan_id_to_fk_idx on public.subscription_events (plan_id_to);
create index if not exists ticket_events_actor_id_fk_idx on public.ticket_events (actor_id);
create index if not exists trial_extension_requests_decided_by_fk_idx on public.trial_extension_requests (decided_by);
create index if not exists visit_requests_cancelled_by_fk_idx on public.visit_requests (cancelled_by);
create index if not exists visit_requests_proposed_by_fk_idx on public.visit_requests (proposed_by);

-- O inventário, para o teste: as FKs de uma coluna sem índice que comece por
-- ela. Só `service_role` — dizer o que falta indexar já é informação.
create or replace function public.unindexed_foreign_keys()
returns table (table_name text, column_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.conrelid::regclass::text, a.attname::text
  from pg_catalog.pg_constraint c
  join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.contype = 'f'
    and c.connamespace = 'public'::regnamespace
    and array_length(c.conkey, 1) = 1
    and not exists (
      select 1 from pg_catalog.pg_index i
      where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
    );
$$;

revoke all on function public.unindexed_foreign_keys() from public, anon, authenticated;
grant execute on function public.unindexed_foreign_keys() to service_role;
