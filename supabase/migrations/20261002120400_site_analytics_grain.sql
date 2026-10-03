-- UProperty Market — Fase 8 (Admin), P8-06
--
-- Corrige a granularidade de `site_analytics_daily`, apanhada ao escrever o
-- adaptador do fornecedor — antes de existir qualquer linha e antes de a página
-- ler a tabela. Migração própria e não reescrita da anterior porque essa já
-- estava aplicada em staging (mesmo critério de 07 §20.7 e §21.9), e um ficheiro
-- de migração editado depois de aplicado **não volta a correr**: a base de dados
-- ficaria calada a divergir do repositório.
--
-- ## O problema
--
-- 05 §1.9 dá à tabela seis dimensões (`date`, `site_mode`, `path`, `source`,
-- `device`, `city`) como se uma linha fosse o cruzamento das seis. **Nenhum
-- fornecedor de analítica sem cookies devolve esse cruzamento** — nem o Umami
-- nem o Plausible. Devolvem, para um intervalo: um total de visitas, e depois
-- uma lista por dimensão ("as páginas mais vistas", "as origens", "os
-- dispositivos", "as cidades"), cada uma somando ao mesmo total.
--
-- Isso não é limitação de produto, é como a analítica sem cookies funciona: sem
-- identificador de visitante, não há como dizer que *esta* visita foi àquela
-- página, daquela origem, naquele dispositivo e naquela cidade ao mesmo tempo.
-- Guardar o cruzamento exigiria exatamente o identificador que 07 §4.4 proíbe.
--
-- Com as seis colunas preenchidas por linha e um `sum(visits)` por cima, cada
-- visita era contada **quatro vezes** — uma por dimensão. Os KPIs de 04 §8.5
-- sairiam quadruplicados, e de forma plausível o suficiente para ninguém notar.
--
-- ## A decisão
--
-- A tabela passa a ter **duas famílias de linhas**, distinguidas pelas colunas
-- de dimensão e sem coluna nova (as de 05 §1.9 bastam):
--
--   **Linha de totais** — `path`, `source`, `device` e `city` todos a `''`.
--   Carrega `visits`, `uniques`, `conversions`, `avg_duration_s` e `bounces`.
--   Uma por (`date`, `site_mode`). É daqui que saem os KPIs e o gráfico.
--
--   **Linha de dimensão** — exatamente uma das quatro preenchida. Carrega só
--   `visits`. É daqui que saem os quatro cartões.
--
-- Consequência que isto fixa: `''` passa a significar "esta linha não é desta
-- dimensão", e **nunca** um valor. Tráfego direto não é `source = ''`, é
-- `source = '(direto)'`; cidade desconhecida é `'(desconhecida)'`. Sem isto, a
-- linha do tráfego direto era indistinguível de uma linha de totais — e o
-- adaptador tem de respeitar a convenção.
--
-- **Patch a 05 §1.9:** acrescentar esta nota à definição de
-- `site_analytics_daily`. Registado em 07 §21.5.

-- ---------------------------------------------------------------------------
-- Predicados das duas famílias, num sítio só
-- ---------------------------------------------------------------------------
-- Escritos como funções `immutable` para a regra viver numa definição e não
-- repetida em quatro `where` — se um dia houver uma quinta dimensão, muda aqui.

create or replace function public.is_analytics_total_row(
  p_path text, p_source text, p_device text, p_city text
)
returns boolean
language sql
immutable
as $$
  select p_path = '' and p_source = '' and p_device = '' and p_city = '';
$$;

comment on function public.is_analytics_total_row(text, text, text, text) is
  'Linha de totais do dia: nenhuma dimensão preenchida. Ver 20261002120400.';

-- ---------------------------------------------------------------------------
-- Os seis KPIs — agora só da linha de totais
-- ---------------------------------------------------------------------------

create or replace function public.admin_site_traffic_summary(
  p_from date,
  p_to date,
  p_site_mode text default null
)
returns table (
  visits bigint,
  uniques bigint,
  conversions bigint,
  conversion_rate numeric,
  avg_duration_s numeric,
  bounce_rate numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  return query
  select
    coalesce(sum(a.visits), 0)::bigint,
    coalesce(sum(a.uniques), 0)::bigint,
    coalesce(sum(a.conversions), 0)::bigint,
    case
      when coalesce(sum(a.visits), 0) = 0 then 0
      else round(sum(a.conversions)::numeric / sum(a.visits), 4)
    end,
    -- Média ponderada pelas visitas. A média das médias diárias daria o mesmo
    -- peso a um dia de 10 visitas e a um de 10 000.
    case
      when coalesce(sum(a.visits), 0) = 0 then 0
      else round(sum(a.avg_duration_s::numeric * a.visits) / sum(a.visits), 1)
    end,
    case
      when coalesce(sum(a.visits), 0) = 0 then 0
      else round(sum(a.bounces)::numeric / sum(a.visits), 4)
    end
  from public.site_analytics_daily a
  where a.date between p_from and p_to
    and (p_site_mode is null or a.site_mode = p_site_mode)
    and public.is_analytics_total_row(a.path, a.source, a.device, a.city);
end;
$$;

-- ---------------------------------------------------------------------------
-- A série do gráfico — idem
-- ---------------------------------------------------------------------------

create or replace function public.admin_site_traffic_series(
  p_from date,
  p_to date,
  p_site_mode text default null
)
returns table (
  date date,
  visits bigint,
  conversions bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  return query
  select
    a.date,
    sum(a.visits)::bigint,
    sum(a.conversions)::bigint
  from public.site_analytics_daily a
  where a.date between p_from and p_to
    and (p_site_mode is null or a.site_mode = p_site_mode)
    and public.is_analytics_total_row(a.path, a.source, a.device, a.city)
  group by a.date
  order by a.date;
end;
$$;

-- ---------------------------------------------------------------------------
-- Os quatro cartões — agora só das linhas de dimensão
-- ---------------------------------------------------------------------------
-- Cada `union all` escolhe as linhas da sua dimensão: a sua coluna preenchida e
-- as outras três vazias. Uma linha de totais não entra em nenhum dos quatro, e
-- uma linha de dimensão não entra nos KPIs.

create or replace function public.admin_site_traffic_breakdown(
  p_from date,
  p_to date,
  p_site_mode text default null,
  p_limit integer default 8
)
returns table (
  dimension text,
  label text,
  visits bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 50);
begin
  if not public.is_staff() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  return query
  with rows_in_range as (
    select a.path, a.source, a.device, a.city, a.visits
    from public.site_analytics_daily a
    where a.date between p_from and p_to
      and (p_site_mode is null or a.site_mode = p_site_mode)
      and not public.is_analytics_total_row(a.path, a.source, a.device, a.city)
  ),
  per_dimension as (
    select 'path'::text as dimension, r.path as label, sum(r.visits) as visits
    from rows_in_range r
    where r.path <> '' and r.source = '' and r.device = '' and r.city = ''
    group by r.path
    union all
    select 'source'::text, r.source, sum(r.visits)
    from rows_in_range r
    where r.source <> '' and r.path = '' and r.device = '' and r.city = ''
    group by r.source
    union all
    select 'device'::text, r.device, sum(r.visits)
    from rows_in_range r
    where r.device <> '' and r.path = '' and r.source = '' and r.city = ''
    group by r.device
    union all
    select 'city'::text, r.city, sum(r.visits)
    from rows_in_range r
    where r.city <> '' and r.path = '' and r.source = '' and r.device = ''
    group by r.city
  ),
  ranked as (
    select
      d.dimension,
      d.label,
      d.visits::bigint as visits,
      row_number() over (partition by d.dimension order by d.visits desc, d.label) as position
    from per_dimension d
    where d.visits > 0
  )
  select k.dimension, k.label, k.visits
  from ranked k
  where k.position <= v_limit
  order by k.dimension, k.visits desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Uma guarda, para a convenção não se perder
-- ---------------------------------------------------------------------------
-- Uma linha com duas ou três dimensões preenchidas não pertence a nenhuma das
-- famílias: não entra nos KPIs nem nos cartões, e desaparecia em silêncio. Se o
-- adaptador se enganar, é preferível a escrita falhar.

alter table public.site_analytics_daily
  add constraint site_analytics_daily_grain check (
    (case when path <> '' then 1 else 0 end
      + case when source <> '' then 1 else 0 end
      + case when device <> '' then 1 else 0 end
      + case when city <> '' then 1 else 0 end) <= 1
  );

-- E as colunas que só a linha de totais carrega ficam a zero nas de dimensão,
-- senão `uniques` e `bounces` apareciam somados onde não fazem sentido.
alter table public.site_analytics_daily
  add constraint site_analytics_daily_dimension_rows_carry_visits_only check (
    public.is_analytics_total_row(path, source, device, city)
    or (uniques = 0 and conversions = 0 and avg_duration_s = 0 and bounces = 0)
  );

grant execute on function public.is_analytics_total_row(text, text, text, text) to authenticated;
revoke all on function public.is_analytics_total_row(text, text, text, text) from public;
