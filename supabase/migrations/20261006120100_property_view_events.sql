-- ---------------------------------------------------------------------------
-- Registo de visualizações de imóveis (D45 · fecha a outra metade de D33)
-- ===========================================================================
-- Duas coisas que o produto precisava e não tinha:
--
-- 1. **Ninguém escrevia em `property_views`.** A tabela nasceu na Fase 2
--    (05 §1.2) e o KPI "Visualizações dos imóveis" do Painel do proprietário,
--    o gráfico de `/painel` e a página de estatísticas de um imóvel liam-na
--    desde a Fase 4 — sempre vazia. `properties.views_count`, que 07 §5.8
--    descreve como "cache mantida por trigger", também nunca foi incrementada.
-- 2. **Não havia registo de QUEM viu**, e é isso que o gráfico "Imóveis
--    vistos" do Painel do comprador (04 §2.4) precisa de saber.
--
-- Decisão do cliente a 6 out 2026, depois de lhe ser apresentado que isto é
-- dado pessoal: cria-se o registo por utilizador, **append-only, com retenção
-- de 90 dias** e purga diária por `pg_cron`. É a mesma figura do
-- `document_access_log` de 07 §13.3, com a retenção mais curta porque o que
-- está em causa não é prova de acesso a documentos de outrem, é o histórico de
-- navegação de quem procura casa.
--
-- Regras que vivem aqui dentro, e não na aplicação:
--
--   - **A própria visita do dono não conta.** Um proprietário a abrir o seu
--     anúncio inflacionava o seu próprio KPI.
--   - **Dedupe de 30 minutos** por (quem vê, que imóvel): recarregar a página
--     ou voltar atrás não são visualizações novas. Sem isto, o número mede
--     cliques no botão de voltar.
--   - **Cada um vê só o seu histórico.** Nem o proprietário do imóvel sabe
--     quem o viu — o que ele tem é o agregado de `property_views`, que é o que
--     05 §1.2 lhe dá. Dar-lhe a lista de pessoas era um produto diferente.
--   - **Uma chamada, três escritas**: o evento, o agregado diário e a cache em
--     `properties`. Numa função `security definer`, para que a tabela de
--     eventos não precise de policy de insert e o agregado continue fechado à
--     escrita direta (a policy de `property_views` nunca abriu insert).
-- ---------------------------------------------------------------------------

create table public.property_view_events (
  id bigint generated always as identity primary key,
  property_id uuid not null references public.properties (id) on delete cascade,
  -- `set null` e não `cascade`: apagar a conta não deve apagar a contagem que
  -- o proprietário já viu no painel dele.
  viewer_id uuid references public.profiles (id) on delete set null,
  viewed_at timestamptz not null default now()
);

-- A leitura do comprador: "os meus últimos 90 dias, por dia".
create index property_view_events_viewer_idx
  on public.property_view_events (viewer_id, viewed_at desc);
-- O dedupe e a purga.
create index property_view_events_property_idx
  on public.property_view_events (property_id, viewed_at desc);
create index property_view_events_purge_idx on public.property_view_events (viewed_at);

alter table public.property_view_events enable row level security;

-- Cada um vê o seu histórico, e mais ninguém — nem o staff (08 §2.2 exige
-- policy, não exige que alguém de fora leia). A escrita é só pela função.
create policy property_view_events_own_select on public.property_view_events
  for select using (viewer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- record_property_view — chamada pelo detalhe do Market
-- ---------------------------------------------------------------------------

create or replace function public.record_property_view(p_property_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_owner uuid;
  v_recent boolean;
begin
  if v_viewer is null then
    return false;
  end if;

  -- Só imóveis publicados contam, e é a view pública que define isso. Um
  -- rascunho aberto pelo dono não é uma visualização de mercado.
  select owner_id into v_owner from public.properties_public where id = p_property_id;
  if v_owner is null or v_owner = v_viewer then
    return false;
  end if;

  select exists (
    select 1 from public.property_view_events
    where property_id = p_property_id
      and viewer_id = v_viewer
      and viewed_at > now() - interval '30 minutes'
  ) into v_recent;

  if v_recent then
    return false;
  end if;

  insert into public.property_view_events (property_id, viewer_id)
  values (p_property_id, v_viewer);

  insert into public.property_views (property_id, day, views_count)
  values (p_property_id, current_date, 1)
  on conflict (property_id, day)
  do update set views_count = public.property_views.views_count + 1;

  update public.properties
  set views_count = views_count + 1
  where id = p_property_id;

  return true;
end;
$$;

revoke execute on function public.record_property_view(uuid) from public;
grant execute on function public.record_property_view(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- my_property_views_daily — a série do Painel do comprador
--
-- Agregada em SQL e não no servidor Node (08 §4.5): devolve no máximo uma
-- linha por dia, em vez de uma linha por visualização.
-- ---------------------------------------------------------------------------

create or replace function public.my_property_views_daily(p_days integer default 365)
returns table (day date, views_count bigint)
language sql
security definer
set search_path = public
as $$
  select viewed_at::date as day, count(*)::bigint as views_count
  from public.property_view_events
  where viewer_id = auth.uid()
    and viewed_at >= current_date - make_interval(days => greatest(p_days, 1))
  group by 1
  order by 1;
$$;

revoke execute on function public.my_property_views_daily(integer) from public;
grant execute on function public.my_property_views_daily(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Retenção: 90 dias (decisão do cliente, 6 out 2026)
--
-- O agregado de `property_views` e a cache de `properties.views_count` NÃO são
-- purgados — não têm dado pessoal e são o histórico do proprietário.
-- ---------------------------------------------------------------------------

create or replace function public.purge_property_view_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.property_view_events
  where viewed_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.purge_property_view_events() from public;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.schedule(
      'upm-purge-property-view-events', '15 4 * * *',
      'select public.purge_property_view_events()'
    );
  end if;
end;
$$;
