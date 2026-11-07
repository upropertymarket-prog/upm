-- =========================================================================
-- A fila de e-mails entregue a partir do Supabase (7 nov 2026)
-- =========================================================================
-- No pré-lançamento o único e-mail que sai é a confirmação da pré-inscrição,
-- e o `mail-worker` (que o entregava) precisava de alojamento próprio só para
-- isso. Decisão do cliente: entregar a fila a partir do Supabase. A Edge
-- Function `outbox` faz o trabalho; aqui fica o agendamento.
--
-- De minuto a minuto, e **só quando há o que entregar**: sem nada em fila não
-- se faz pedido nenhum — a função não acorda 43 000 vezes por mês para nada.
--
-- O segredo e o endereço da função vivem no Vault, não nesta migração (uma
-- migração vai para o repositório). Criam-se uma vez, fora dela:
--
--   select vault.create_secret('<segredo, 32+ caracteres>', 'outbox_cron_secret');
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/outbox',
--                              'outbox_function_url');
--
-- Sem eles o agendamento corre e não faz nada (a condição do `where` falha),
-- em vez de chamar a função sem credencial.
--
-- Quando o `mail-worker` for alojado (o Suporte, no lançamento oficial):
--   select cron.unschedule('upm-drain-outbox');
-- Mesmo esquecido, não há envio duplicado: as duas vias marcam a entrega
-- antes de a enviar, e o id da entrega é a chave de idempotência no Resend.
-- =========================================================================

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    -- Postgres local sem as extensões: a migração passa, o agendamento não.
    raise notice 'pg_cron/pg_net indisponíveis: agendamento da fila não criado';
    return;
  end if;

  execute 'create extension if not exists pg_cron';
  execute 'create extension if not exists pg_net';

  -- Idempotente: reaplicar a migração não duplica o agendamento.
  if exists (select 1 from cron.job where jobname = 'upm-drain-outbox') then
    perform cron.unschedule('upm-drain-outbox');
  end if;

  perform cron.schedule(
    'upm-drain-outbox',
    '* * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets
                where name = 'outbox_function_url'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-outbox-secret', (select decrypted_secret from vault.decrypted_secrets
                              where name = 'outbox_cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000
      )
      where exists (select 1 from vault.decrypted_secrets where name = 'outbox_function_url')
        and exists (select 1 from vault.decrypted_secrets where name = 'outbox_cron_secret')
        and (
          exists (select 1 from public.notification_deliveries
                  where status = 'queued' and attempts < 5)
          -- O que ficou preso a meio também conta: é a função que o devolve
          -- à fila (regra 4 de `_shared/outbox-core.ts`).
          or exists (select 1 from public.notification_deliveries
                     where status = 'sending' and updated_at < now() - interval '15 minutes')
        );
    $job$
  );
end;
$$;
