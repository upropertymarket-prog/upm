-- UProperty Market — conversões do site recolhidas pela própria base
--
-- `site_analytics_daily` estava vazia: as conversões só entravam pelo
-- `pnpm analytics:import --conversions-only`, que nunca correu sozinho (não há
-- agendamento) e, corrido à mão, falhava duas vezes — o `server-only` no arranque
-- e o `is_staff()` de `site_conversions_daily`, que recusa a `service_role` com
-- que o importador fala.
--
-- As conversões são nossas (07 §21.5 #2), logo quem as conta é a base, de hora a
-- hora, pelo pg_cron: sem segredos num workflow, sem fornecedor. O importador do
-- Umami continua a ser quem escreve as visitas.
--
-- E conta-se só o formulário de pré-inscrição: `site_leads` guarda também
-- `contacto` e `empresas`, que a versão anterior somava como conversões.

-- ---------------------------------------------------------------------------
-- O importador do Umami fala como service_role — tem de poder ler as conversões
-- ---------------------------------------------------------------------------

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
  if not (public.is_staff() or coalesce(auth.role(), '') = 'service_role') then
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

  -- pre: pré-inscrições por dia.
  return query
  select l.created_at::date, 'pre'::text, count(*)::bigint
  from public.site_leads l
  where l.form = 'preinscricao' and l.created_at::date between p_from and p_to
  group by l.created_at::date;
end;
$$;

-- ---------------------------------------------------------------------------
-- refresh_site_conversions — recontar e escrever, só a coluna `conversions`
-- ---------------------------------------------------------------------------
-- Escreve na linha de totais do dia, no modo em que o site está (a mesma flag
-- que o importador lê). Três decisões:
--
-- * **Todos os dias do intervalo, também os de zero.** É uma recontagem, não um
--   acréscimo: um lead apagado (`admin_apagar_lead`) baixa o número na corrida
--   seguinte em vez de ficar contado para sempre.
-- * **Só `conversions` no `on conflict`.** As visitas que o Umami lá tenha
--   escrito ficam. O `--conversions-only` antigo punha-as a zero.
-- * **O dia de hoje entra.** O "ontem e não hoje" do importador é por causa do
--   fornecedor; o que é nosso pode ser parcial, porque daqui a uma hora é
--   recontado.

create or replace function public.refresh_site_conversions(
  p_from date default (current_date - 7),
  p_to date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_rows integer;
begin
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'Intervalo inválido: % a %', p_from, p_to using errcode = '22023';
  end if;

  select case when f.value = to_jsonb('post'::text) then 'post' else 'pre' end
    into v_mode
  from public.feature_flags f
  where f.key = 'launch_mode';
  v_mode := coalesce(v_mode, 'pre');

  insert into public.site_analytics_daily (date, site_mode, conversions)
  select d.day::date, v_mode, coalesce(c.n, 0)
  from generate_series(p_from, p_to, interval '1 day') as d(day)
  left join (
    select l.created_at::date as day, count(*) as n
    from public.site_leads l
    where v_mode = 'pre' and l.form = 'preinscricao'
      and l.created_at::date between p_from and p_to
    group by 1
    union all
    select pr.created_at::date, count(*)
    from public.profiles pr
    where v_mode = 'post' and pr.created_at::date between p_from and p_to
      and pr.role in ('buyer', 'owner')
    group by 1
  ) c on c.day = d.day::date
  on conflict on constraint site_analytics_daily_key
  do update set conversions = excluded.conversions
  where public.site_analytics_daily.conversions is distinct from excluded.conversions;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

comment on function public.refresh_site_conversions(date, date) is
  'Reconta as conversões (pré-inscrições em `pre`, contas em `post`) e escreve-as '
  'na linha de totais de site_analytics_daily, sem tocar nas visitas. pg_cron de '
  'hora a hora; só service_role a chama.';

revoke all on function public.refresh_site_conversions(date, date) from public;
revoke all on function public.refresh_site_conversions(date, date) from anon;
revoke all on function public.refresh_site_conversions(date, date) from authenticated;
grant execute on function public.refresh_site_conversions(date, date) to service_role;

-- O último mês entra agora, e não daqui a uma hora.
select public.refresh_site_conversions(current_date - 30, current_date);

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.schedule(
      'upm-refresh-site-conversions', '5 * * * *',
      'select public.refresh_site_conversions()'
    );
  end if;
end;
$$;
