-- =========================================================================
-- A15 — a superfície que a chave pública alcança (2 nov 2026)
-- =========================================================================
-- A chave `anon` não é segredo: vai no browser de toda a gente. Medido a
-- 2 nov, o `anon` tinha `execute` em 100 funções `security definer` — e 39
-- não verificavam identidade nenhuma. Chamadas a sério, só com a chave
-- pública, todas correram: `notify` (notificação com link à escolha na conta
-- de qualquer pessoa), `apply_plan_downgrade` (sobre qualquer perfil),
-- `upsert_owner_lead`, `record_auth_attempt` (trancar a entrada de outra
-- pessoa), os jobs (`run_search_alerts`, `complete_due_visits`, as purgas)
-- e as leituras de plano e papel de qualquer uuid. Ver 12 §30.
--
-- ## A causa: os privilégios por omissão
--
-- O Supabase dá `execute` em cada função nova a `anon` e a `authenticated`
-- (e o Postgres dá-o a `public`, de que o `anon` herda). As migrações mais
-- recentes já faziam `revoke ... from anon`; as antigas não. Uma regra que
-- depende de cada um se lembrar falha na primeira vez que alguém esquece.
--
-- Por isso, três camadas:
--
--  1. **Os privilégios por omissão deixam de incluir `anon` e `public`.**
--     Uma função nova só chega ao `anon` com um `grant ... to anon` escrito
--     — e o teste `superficie-anon.test.ts` recusa esse `grant` para quem
--     não estiver na lista.
--  2. **O `anon` perde o `execute` em toda a `security definer` que não
--     precise dele.** Ficam as 12 da lista abaixo, cada uma com a razão.
--  3. **As funções internas perdem também o `authenticated`.** São jobs,
--     triggers chamados por outras funções, ou o webhook — nenhuma é chamada
--     por uma sessão. Um utilizador com conta não tem de poder disparar a
--     purga ou notificar outro.
--
-- As funções `security invoker` não mudam: correm com os direitos de quem as
-- chama, e as que existem são puras (formatar, normalizar, validar NIF) ou
-- passam pela RLS (`properties_for_map`, `properties_within_polygon`).
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Privilégios por omissão
-- -------------------------------------------------------------------------
-- As migrações correm como `postgres`; é para os objetos dele que a regra
-- vale. `authenticated` e `service_role` mantêm o `execute` por omissão — o
-- guarda deles é a verificação de identidade dentro de cada função, e o teste
-- vigia as que não a têm.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;

-- -------------------------------------------------------------------------
-- 2. O `anon` só executa o que um visitante precisa
-- -------------------------------------------------------------------------
-- A mesma lista está em `packages/db/src/superficie-anon.test.ts`; as duas
-- mudam juntas.
--
--   submit_site_lead, confirm_site_lead   formulários do site e confirmação
--   campaign_unsubscribe                  cancelar campanhas pelo link do e-mail
--   listing_availability                  "vendido" vs. "nunca existiu" na ficha
--   current_legal_document                Termos e Privacidade, antes de ter conta
--   resolve_file_share,                   links de partilha, abertos sem conta
--   resolve_contract_share                (o token e o código são o guarda)
--   is_admin, is_internal, is_marketing,  usados pelas policies, que o Postgres
--   is_staff, is_support                  avalia também para o `anon`
--                                         (20261101110000)
do $$
declare
  v_permitidas text[] := array[
    'submit_site_lead', 'confirm_site_lead', 'campaign_unsubscribe',
    'listing_availability', 'current_legal_document',
    'resolve_file_share', 'resolve_contract_share',
    'is_admin', 'is_internal', 'is_marketing', 'is_staff', 'is_support'
  ];
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as assinatura,
           p.proname,
           has_function_privilege('authenticated', p.oid, 'execute') as tinha_auth
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
      and not (p.proname = any (v_permitidas))
  loop
    execute format('revoke execute on function %s from public, anon', v_fn.assinatura);
    -- Tirar o `public` não pode tirar o `authenticated` a quem o tinha só por
    -- herança: repõe-se explícito, e o passo 3 retira-o a quem não deve ter.
    if v_fn.tinha_auth then
      execute format('grant execute on function %s to authenticated', v_fn.assinatura);
    end if;
    execute format('grant execute on function %s to service_role', v_fn.assinatura);
  end loop;
end;
$$;

-- -------------------------------------------------------------------------
-- 3. Internas: nem `anon` nem `authenticated`
-- -------------------------------------------------------------------------
-- Nenhuma é chamada por uma sessão (verificado contra todo o `.rpc(` de
-- `apps/` e `packages/`, as policies e as vistas, a 2 nov). Os chamadores
-- legítimos não precisam do `execute` delas: o pg_cron corre como
-- `postgres`; os triggers e as outras `security definer` correm como o dono;
-- o webhook e o limite de tentativas usam `service_role`.
do $$
declare
  v_internas text[] := array[
    -- escrevem em nome de outra pessoa
    'notify', 'upsert_owner_lead', 'apply_plan_downgrade',
    'record_subscription_agreement',
    -- limite de tentativas: só o servidor, por `service_role` (packages/db/src/auth.ts)
    'check_auth_rate_limit', 'record_auth_attempt',
    -- jobs do pg_cron
    'complete_due_visits', 'run_search_alerts',
    'purge_cloud_recycle_bin', 'purge_document_access_log',
    'purge_property_view_events', 'purge_ticket_technical_data',
    -- leem papel, plano ou uso de qualquer uuid
    'role_of', 'effective_limits', 'plan_usage', 'plan_limit_exceeded',
    'cloud_usage_bytes', 'cloud_limit_bytes', 'account_blocked',
    'suggest_ticket_severity'
  ];
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname = any (v_internas)
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      v_fn.assinatura
    );
    execute format('grant execute on function %s to service_role', v_fn.assinatura);
  end loop;
end;
$$;

-- -------------------------------------------------------------------------
-- 4. O inventário, para o teste ao vivo
-- -------------------------------------------------------------------------
-- O OpenAPI do PostgREST só responde à `service_role`, e mostra o que ela vê,
-- não o que o `anon` vê. Esta função devolve a superfície tal como o catálogo
-- a conhece. Só `service_role`: saber que funções existem já é informação.
create or replace function public.security_surface()
returns table (
  name text,
  security_definer boolean,
  anon_execute boolean,
  authenticated_execute boolean,
  is_trigger boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.proname::text,
         p.prosecdef,
         has_function_privilege('anon', p.oid, 'execute'),
         has_function_privilege('authenticated', p.oid, 'execute'),
         p.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f';
$$;

revoke all on function public.security_surface() from public, anon, authenticated;
grant execute on function public.security_surface() to service_role;

-- -------------------------------------------------------------------------
-- 5. O histórico do pg_cron entra na retenção
-- -------------------------------------------------------------------------
-- `cron.job_run_details` não se purga sozinho: 32 mil linhas desde 29 set,
-- ~10 mil por semana só do `upm-scheduled-sends`, que corre a cada minuto.
-- Numa base Nano, uma tabela que só cresce acaba por pesar. Trinta dias
-- chegam para investigar uma falha; o que importa guardar mais tempo — o
-- resultado de cada purga — já vai para o `audit_log` pelo `run_retention`.
create or replace function public.purge_cron_job_run_details()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from cron.job_run_details
  where end_time < now() - interval '30 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.purge_cron_job_run_details() from public, anon, authenticated;
grant execute on function public.purge_cron_job_run_details() to service_role;

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
    'purge_personal_data_access_log',
    'purge_cron_job_run_details'
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
        when 'purge_cron_job_run_details' then v_n := public.purge_cron_job_run_details();
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
