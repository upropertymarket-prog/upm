-- ===========================================================================
-- As pré-inscrições não saem antes do lançamento (cliente, 20 nov 2026)
-- ===========================================================================
-- Uma pré-inscrição não tem atividade: a pessoa deixa o e-mail e espera. Com a
-- regra geral dos 12 meses sem atividade, se o lançamento oficial chegasse
-- mais de um ano depois, a lista de espera era apagada antes de ser avisada —
-- que é o único fim para que foi guardada.
--
--   - Em `launch_mode = 'pre'`, nenhuma pré-inscrição é apagada pela purga.
--   - Depois do lançamento, os 12 meses contam também a partir do dia do
--     lançamento (o `updated_at` da flag `launch_mode`, que muda quando passa
--     a 'post'). Sem isto, uma inscrição de há 14 meses saía na primeira noite
--     depois do lançamento, antes de receber o e-mail.
--
-- Os outros formulários e os convertidos ficam como estavam. A saída a pedido
-- continua a ser a equipa (`admin_delete_site_lead`) ou o link de remover dos
-- e-mails já enviados.
-- ===========================================================================

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
  v_mode text;
  v_launch_at timestamptz;
begin
  select f.value #>> '{}', f.updated_at
    into v_mode, v_launch_at
    from public.feature_flags f
   where f.key = 'launch_mode';

  select coalesce(array_agg(l.id), '{}')
    into v_ids
    from public.site_leads l
   where l.status <> 'converted'
     and not (l.form = 'preinscricao' and coalesce(v_mode, 'pre') <> 'post')
     and greatest(
           l.created_at,
           l.updated_at,
           coalesce(l.confirmed_at, l.created_at),
           coalesce(
             (select max(e.created_at) from public.site_lead_events e where e.lead_id = l.id),
             l.created_at
           ),
           case when l.form = 'preinscricao' then v_launch_at else l.created_at end
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
  'Apaga leads não convertidos 12 meses após a última interação. Pré-inscrições: nunca em pré-lançamento; depois, 12 meses contam também desde o lançamento (20 nov 2026).';
