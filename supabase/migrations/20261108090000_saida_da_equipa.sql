-- ===========================================================================
-- A saída de alguém da equipa (decisão do cliente, 8 nov 2026)
-- ===========================================================================
-- Quem sai é suspenso de imediato. Depois de o trabalho passar a outra
-- pessoa, a conta **elimina-se**: não fica dois anos no sistema por estar no
-- registo de acessos. O que tiver de ser guardado sai antes, num CSV que a
-- administração descarrega e guarda fora (`exportStaffRecord`, interno).
--
-- Três registos prendiam o perfil com `on delete restrict`, e uma conta da
-- equipa não se conseguia apagar:
--   personal_data_access_log.actor_profile_id   (quem abriu dados de quem)
--   property_moderation_events.actor_id         (quem moderou o imóvel)
--   site_lead_events.actor_id                   (notas e mudanças num lead)
--
-- Passam a `on delete set null`, como o `audit_log` desde a A8: a linha
-- fica — o acontecimento, a data, o imóvel ou o lead —, e só o autor passa
-- a null. Nenhuma linha se apaga; o `personal_data_access_log` continua só
-- de acrescentar, e a única alteração que o trigger deixa passar é essa
-- (`audit_append_only('actor_profile_id')`, a mesma exceção do `audit_log`).
-- ===========================================================================

set search_path = public, extensions;

-- 1. personal_data_access_log -----------------------------------------------
alter table public.personal_data_access_log
  alter column actor_profile_id drop not null;
alter table public.personal_data_access_log
  drop constraint personal_data_access_log_actor_profile_id_fkey;
alter table public.personal_data_access_log
  add constraint personal_data_access_log_actor_profile_id_fkey
  foreign key (actor_profile_id) references public.profiles (id) on delete set null;

drop trigger if exists personal_data_access_log_append_only on public.personal_data_access_log;
create trigger personal_data_access_log_append_only
  before update or delete on public.personal_data_access_log
  for each row execute function public.audit_append_only('actor_profile_id');

-- 2. property_moderation_events ---------------------------------------------
alter table public.property_moderation_events
  alter column actor_id drop not null;
alter table public.property_moderation_events
  drop constraint property_moderation_events_actor_id_fkey;
alter table public.property_moderation_events
  add constraint property_moderation_events_actor_id_fkey
  foreign key (actor_id) references public.profiles (id) on delete set null;

-- 3. site_lead_events --------------------------------------------------------
alter table public.site_lead_events
  alter column actor_id drop not null;
alter table public.site_lead_events
  drop constraint site_lead_events_actor_id_fkey;
alter table public.site_lead_events
  add constraint site_lead_events_actor_id_fkey
  foreign key (actor_id) references public.profiles (id) on delete set null;

comment on column public.personal_data_access_log.actor_profile_id is
  'Quem consultou. Null: a conta da equipa foi eliminada (o registo dela saiu antes em CSV).';
comment on column public.property_moderation_events.actor_id is
  'Quem moderou. Null: a conta da equipa foi eliminada.';
comment on column public.site_lead_events.actor_id is
  'Quem escreveu ou mudou. Null: a conta da equipa foi eliminada.';
