-- UProperty Market — Fase 8 (Admin), P8-06
--
-- Tráfego do site: `site_analytics_daily` (05 §1.9), as agregações que a página
-- de 04 §8.5 lê, e a retenção. Decisões em 07 §21.5 e §21.6.
--
-- Três regras moldam esta tabela:
--
-- 1. **Nenhum dado pessoal.** Nem IP, nem user agent cru, nem identificador de
--    visitante. Só linhas diárias já agregadas, como 07 §4.4 exige. É por isso
--    que `uniques` vem do fornecedor (Umami) e não é calculado por nós: calculá-lo
--    obrigaria a hashear IP + user agent, e isso é tratar um dado pessoal.
-- 2. **As conversões são nossas** (07 §21.5 #2). Pré-inscrições e contas criadas
--    vivem em `site_leads` e `profiles`; não se pede a um terceiro um número que
--    já temos, e assim a coluna tem dados verdadeiros antes de existirem
--    credenciais do fornecedor.
-- 3. **Escrita só pelo servidor.** `service_role`, sem policy de insert, com
--    `revoke` ao PostgREST (08 §3.5) — é uma tabela de importação, não um
--    formulário.

-- ---------------------------------------------------------------------------
-- site_analytics_daily — 05 §1.9
-- ---------------------------------------------------------------------------
-- `path`, `source`, `device` e `city` são as dimensões dos quatro cartões de
-- 04 §8.5. A chave única é o conjunto todo, porque é isso que torna a importação
-- idempotente: correr o job duas vezes para o mesmo dia faz `upsert`, não
-- duplica linhas.
--
-- `source` e `city` guardam '' e não null quando o fornecedor não sabe — uma
-- chave única com nulls deixa de ser única no Postgres (null <> null), e era por
-- aí que a reimportação duplicaria a linha de "origem desconhecida".

create table public.site_analytics_daily (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  site_mode text not null check (site_mode in ('pre', 'post')),
  path text not null default '',
  source text not null default '',
  device text not null default '',
  city text not null default '',
  visits bigint not null default 0 check (visits >= 0),
  uniques bigint not null default 0 check (uniques >= 0),
  conversions bigint not null default 0 check (conversions >= 0),
  avg_duration_s integer not null default 0 check (avg_duration_s >= 0),
  bounces bigint not null default 0 check (bounces >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_analytics_daily_key
    unique (date, site_mode, path, source, device, city)
);

-- O filtro da página é sempre "intervalo de dias" + "modo do site", por esta
-- ordem (04 §8.5), e é esse o índice. `date desc` porque ninguém abre a página
-- para ver o mês passado primeiro.
create index site_analytics_daily_date_idx
  on public.site_analytics_daily (date desc, site_mode);

create trigger site_analytics_daily_set_updated_at
  before update on public.site_analytics_daily
  for each row execute function public.set_updated_at();

comment on table public.site_analytics_daily is
  'Tráfego diário agregado do site público (05 §1.9). Sem dados pessoais: '
  'nem IP, nem user agent, nem id de visitante. Importado de um fornecedor sem '
  'cookies (07 §21.5); as conversões vêm das nossas tabelas. Retenção 26 meses '
  '(07 §21.6).';

-- 08 §4.9 — plano de particionamento escrito antes de ser preciso:
--
-- Esta é uma tabela de eventos agregados, não de eventos crus. O volume é
-- (dias × modos × caminhos × origens × dispositivos × cidades), e a explosão
-- combinatória vem das cidades: ~200 caminhos × ~20 origens × 3 dispositivos ×
-- ~300 cidades daria ~3,6 M linhas/dia no pior caso teórico, mas na prática o
-- fornecedor só devolve as combinações com tráfego — uns milhares de linhas por
-- dia, ~1 M ao fim de um ano.
--
-- Abaixo de 10 M linhas, o índice acima é confortável e particionar só
-- acrescentaria complexidade. **Quando passar dos 10 M**, particionar por
-- `range (date)` com uma partição por mês: a chave está já na primeira posição
-- do índice e em todas as queries da página, por isso o `partition by range
-- (date)` entra sem mudar uma única query. A purga de 26 meses passa a ser um
-- `drop partition`, que é instantâneo, em vez do `delete` de baixo.

-- ---------------------------------------------------------------------------
-- RLS — 08 §2.1/§2.2
-- ---------------------------------------------------------------------------
-- Leitura para staff (04 §8.5 põe a página no Admin; o Suporte lê para os seus
-- relatórios de e-mail). Escrita por ninguém: sem policy de insert/update, o
-- `service_role` continua a escrever porque ignora RLS, e mais ninguém.

alter table public.site_analytics_daily enable row level security;

create policy site_analytics_daily_staff_select on public.site_analytics_daily
  for select using (public.is_staff());

-- 08 §3.5 — o PostgREST não expõe o que só o servidor usa.
revoke insert, update, delete on public.site_analytics_daily from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Conversões — a metade que é nossa (07 §21.5 #2)
-- ---------------------------------------------------------------------------
-- Uma função só, com os dois modos lá dentro, para a importação não ter de
-- saber de onde vem cada número:
--
--   `pre`  — pré-inscrições, de `site_leads`
--   `post` — contas criadas, de `profiles`
--
-- `site_leads` nasce em P8-04 e **ainda não existe** quando esta migração corre.
-- Em vez de esperar por ela, a função pergunta ao catálogo se a tabela já lá
-- está. Quando P8-04 a criar, o braço `pre` começa a devolver números sem esta
-- função ser tocada — e a alternativa (adiar P8-06 ou criar aqui uma tabela que
-- é de outra tarefa) era pior.

create or replace function public.site_conversions_daily(
  p_from date,
  p_to date
)
returns table (
  date date,
  site_mode text,
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

  -- post: contas criadas por dia.
  return query
  select
    pr.created_at::date,
    'post'::text,
    count(*)::bigint
  from public.profiles pr
  where pr.created_at::date between p_from and p_to
    and pr.role in ('buyer', 'owner')
  group by pr.created_at::date;

  -- pre: pré-inscrições por dia, quando a tabela de P8-04 existir.
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'site_leads'
  ) then
    return query execute format(
      'select l.created_at::date, %L::text, count(*)::bigint
         from public.site_leads l
        where l.created_at::date between %L and %L
        group by l.created_at::date',
      'pre', p_from, p_to
    );
  end if;
end;
$$;

comment on function public.site_conversions_daily(date, date) is
  'Conversões por dia a partir das NOSSAS tabelas (07 §21.5 #2): contas criadas '
  'para `post`, pré-inscrições para `pre`. O braço `pre` acende quando P8-04 '
  'criar site_leads.';

-- ---------------------------------------------------------------------------
-- As leituras da página — agregadas em SQL (08 §4.5 e §4.7)
-- ---------------------------------------------------------------------------
-- A página faz um número FIXO de chamadas, independentemente de quantos dias,
-- caminhos e cidades existam. Nada se conta no servidor de aplicação.

/**
 * Os seis KPIs de 04 §8.5, numa linha.
 *
 * `bounce_rate` e `conversion_rate` saem daqui já calculados em vez de serem
 * divididos na UI: são a mesma razão em dois sítios se a UI os fizer, e foi
 * assim que 07 §19.3 obrigou `effective_limits` a ser a única fonte de quota.
 *
 * `avg_duration_s` é média **ponderada pelas visitas** — a média das médias
 * diárias daria peso igual a um dia de 10 visitas e a um de 10 000.
 */
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
    and (p_site_mode is null or a.site_mode = p_site_mode);
end;
$$;

/** A série do gráfico: um ponto por dia, visitas e conversões. */
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
  group by a.date
  order by a.date;
end;
$$;

/**
 * Os quatro cartões de 04 §8.5 — páginas, origem, dispositivos, cidades — numa
 * chamada só, com a dimensão como coluna.
 *
 * Quatro queries separadas seriam quatro viagens à base de dados para desenhar
 * quatro cartões que aparecem ao mesmo tempo. `p_limit` corta cada dimensão
 * (08 §3.4: nenhuma coleção sai sem limite), e a linha que sobra de fora conta
 * no "outros" que a UI calcula a partir do total do resumo.
 */
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
  ),
  per_dimension as (
    select 'path'::text as dimension, nullif(r.path, '') as label, sum(r.visits) as visits
    from rows_in_range r group by r.path
    union all
    select 'source'::text, nullif(r.source, ''), sum(r.visits)
    from rows_in_range r group by r.source
    union all
    select 'device'::text, nullif(r.device, ''), sum(r.visits)
    from rows_in_range r group by r.device
    union all
    select 'city'::text, nullif(r.city, ''), sum(r.visits)
    from rows_in_range r group by r.city
  ),
  ranked as (
    select
      d.dimension,
      coalesce(d.label, '—') as label,
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

grant execute on function public.site_conversions_daily(date, date) to authenticated;
grant execute on function public.admin_site_traffic_summary(date, date, text) to authenticated;
grant execute on function public.admin_site_traffic_series(date, date, text) to authenticated;
grant execute on function public.admin_site_traffic_breakdown(date, date, text, integer) to authenticated;

-- Numa função, o alvo do revoke é PUBLIC: `from anon` não tira o que vem por
-- PUBLIC (lição de 07 §21.9).
revoke all on function public.site_conversions_daily(date, date) from public;
revoke all on function public.admin_site_traffic_summary(date, date, text) from public;
revoke all on function public.admin_site_traffic_series(date, date, text) from public;
revoke all on function public.admin_site_traffic_breakdown(date, date, text, integer) from public;

-- ---------------------------------------------------------------------------
-- Retenção — 26 meses (07 §21.6)
-- ---------------------------------------------------------------------------
-- Escrita na migração e não à mão, como 07 §13.6 exige. Vinte e seis meses e
-- não vinte e quatro para que a comparação com o mesmo mês do ano anterior
-- tenha sempre os dois meses inteiros.

create or replace function public.purge_site_analytics()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.site_analytics_daily
  where date < (current_date - interval '26 months')::date;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_site_analytics() from public;
revoke all on function public.purge_site_analytics() from anon;
revoke all on function public.purge_site_analytics() from authenticated;
grant execute on function public.purge_site_analytics() to service_role;

comment on function public.purge_site_analytics() is
  'Purga o que passa dos 26 meses (07 §21.6). Agendada por pg_cron; só '
  'service_role a chama.';

-- pg_cron dentro de uma guarda, como nas Fases 5 e 6: sem a extensão
-- disponível a migração continua e a função fica chamável à mão.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.schedule(
      'upm-purge-site-analytics', '30 4 1 * *',
      'select public.purge_site_analytics()'
    );
  end if;
end;
$$;
