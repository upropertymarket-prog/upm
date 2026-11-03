-- =========================================================================
-- O gráfico de visitas do proprietário, somado na base (3 nov 2026)
-- =========================================================================
-- O Painel lia `property_views` — uma linha por imóvel por dia — e somava em
-- JS. O PostgREST corta qualquer resposta às 1000 linhas, sem aviso: com 34
-- imóveis, 30 dias já passam disso, e o gráfico mostrava menos visitas do que
-- as reais, parecendo certo. Ver 12 §30 ("listas cortadas em silêncio").
--
-- Devolve o mesmo formato que o Painel já usava (`day`, `views_count`), uma
-- linha por dia: no máximo `p_days` linhas, seja qual for o número de imóveis.
--
-- `security invoker`: corre com a RLS de quem pede, e o filtro pelo dono é
-- explícito por cima dela (defesa em profundidade, padrão do projeto). Nasce
-- já sem `anon` — os privilégios por omissão deixaram de o dar (A15) — e o
-- `grant` ao `authenticated` fica escrito, para não depender deles.
-- =========================================================================

create or replace function public.my_owned_property_views_daily(p_days integer)
returns table (day date, views_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select pv.day, sum(pv.views_count)::bigint
  from public.property_views pv
  join public.properties p on p.id = pv.property_id
  where p.owner_id = auth.uid()
    and pv.day >= current_date - greatest(p_days, 1)
  group by pv.day
  order by pv.day;
$$;

revoke all on function public.my_owned_property_views_daily(integer) from public, anon;
grant execute on function public.my_owned_property_views_daily(integer) to authenticated, service_role;
