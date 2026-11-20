-- ===========================================================================
-- A pré-inscrição deixa de confirmar por e-mail, e de ser apagada aos 30 dias
-- (cliente, 20 nov 2026)
-- ===========================================================================
-- Em pré-lançamento, a pré-inscrição guarda um endereço para um único fim:
-- avisar no dia do lançamento, que pode ser meses depois. O double opt-in
-- (`purge_unconfirmed_site_leads`, 30 dias) apagava quem não clicasse no link
-- — e era precisamente essa a pessoa que se queria avisar. Com o Resend em modo
-- de teste, nenhum e-mail de confirmação chegava a ninguém, por isso a purga
-- ia apagar todas as pré-inscrições reais.
--
-- A action do site já não enfileira o e-mail (`pre-inscricao/actions.ts`).
-- Aqui sai a purga: o job e a função. Os leads ficam com a regra de todos —
-- 12 meses sem atividade, exceto os convertidos (`purge_stale_site_leads`,
-- dentro do `run_retention`).
--
-- `confirmed_at`, `confirm_token_hash` e `removal_token_hash` ficam: os links
-- de e-mails já enviados continuam a funcionar, e não se perde o histórico de
-- quem confirmou.
-- ===========================================================================

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'upm-purge-unconfirmed-site-leads') then
      perform cron.unschedule('upm-purge-unconfirmed-site-leads');
    end if;
  end if;
end;
$$;

drop function if exists public.purge_unconfirmed_site_leads();
