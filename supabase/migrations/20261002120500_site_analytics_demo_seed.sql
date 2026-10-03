-- UProperty Market — Fase 8 (Admin), P8-06
--
-- Dados de demonstração de `site_analytics_daily`, como **função** e não como
-- bloco solto no `seed.sql`.
--
-- Porquê função: o site público entra numa fase posterior, por isso a tabela
-- nasce vazia e a página de 04 §8.5 só mostraria o estado vazio — e 07 §16 exige
-- revisão visual antes de a fase fechar. O `seed.sql` resolve-o num ambiente
-- novo (`supabase db reset`), mas **em staging não se faz reset**: há lá dados
-- das Fases 2 a 7. Com a lógica numa função, o `seed.sql` chama-a e o staging
-- também, por RPC, sem duas cópias dos mesmos pesos a divergir com o tempo.
--
-- Determinística de propósito: sem `random()`, o mesmo dia dá sempre os mesmos
-- números e correr duas vezes não muda o gráfico. Um seed aleatório faz a
-- revisão visual perseguir um ecrã diferente a cada corrida.
--
-- As linhas de dimensão **somam exatamente** as visitas do dia, como somariam as
-- do fornecedor (a última fatia recebe o resto). Um seed que não fechasse as
-- contas ensinaria a desconfiar dos cartões quando o problema era o seed.

create or replace function public.seed_demo_site_analytics(p_days integer default 45)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
  v_offset integer;
  v_visits bigint;
  v_remaining bigint;
  v_share bigint;
  v_index integer;
  v_rows integer := 0;
  -- Pesos em centésimos, somando 100 em cada dimensão.
  v_paths text[] := array['/', '/precos', '/imoveis', '/pre-inscricao', '/termos'];
  v_path_w integer[] := array[46, 22, 16, 11, 5];
  v_sources text[] := array['(direto)', 'google.com', 'facebook.com', 'linkedin.com'];
  v_source_w integer[] := array[41, 34, 15, 10];
  v_devices text[] := array['mobile', 'desktop', 'tablet'];
  v_device_w integer[] := array[58, 36, 6];
  v_cities text[] := array['Lisboa', 'Porto', 'Braga', 'Faro', '(desconhecida)'];
  v_city_w integer[] := array[38, 24, 14, 12, 12];
begin
  for v_offset in 0..(greatest(p_days, 1) - 1) loop
    v_day := current_date - v_offset;

    -- Uma onda suave com menos tráfego ao fim de semana, para o gráfico ter
    -- forma em vez de ser um planalto.
    v_visits := 120
      + ((v_offset * 37) % 70)
      - case when extract(isodow from v_day) in (6, 7) then 45 else 0 end;

    insert into public.site_analytics_daily (
      date, site_mode, path, source, device, city,
      visits, uniques, conversions, avg_duration_s, bounces
    ) values (
      v_day, 'pre', '', '', '', '',
      v_visits,
      round(v_visits * 0.78),
      greatest(0, round(v_visits / 28.0)),
      52 + ((v_offset * 11) % 90),
      round(v_visits * 0.54)
    )
    on conflict (date, site_mode, path, source, device, city) do update set
      visits = excluded.visits,
      uniques = excluded.uniques,
      conversions = excluded.conversions,
      avg_duration_s = excluded.avg_duration_s,
      bounces = excluded.bounces;
    v_rows := v_rows + 1;

    -- Páginas
    v_remaining := v_visits;
    for v_index in 1..array_length(v_paths, 1) loop
      v_share := case
        when v_index = array_length(v_paths, 1) then v_remaining
        else round(v_visits * v_path_w[v_index] / 100.0)
      end;
      v_remaining := v_remaining - v_share;
      insert into public.site_analytics_daily (date, site_mode, path, visits)
      values (v_day, 'pre', v_paths[v_index], greatest(v_share, 0))
      on conflict (date, site_mode, path, source, device, city)
        do update set visits = excluded.visits;
      v_rows := v_rows + 1;
    end loop;

    -- Origem
    v_remaining := v_visits;
    for v_index in 1..array_length(v_sources, 1) loop
      v_share := case
        when v_index = array_length(v_sources, 1) then v_remaining
        else round(v_visits * v_source_w[v_index] / 100.0)
      end;
      v_remaining := v_remaining - v_share;
      insert into public.site_analytics_daily (date, site_mode, source, visits)
      values (v_day, 'pre', v_sources[v_index], greatest(v_share, 0))
      on conflict (date, site_mode, path, source, device, city)
        do update set visits = excluded.visits;
      v_rows := v_rows + 1;
    end loop;

    -- Dispositivos
    v_remaining := v_visits;
    for v_index in 1..array_length(v_devices, 1) loop
      v_share := case
        when v_index = array_length(v_devices, 1) then v_remaining
        else round(v_visits * v_device_w[v_index] / 100.0)
      end;
      v_remaining := v_remaining - v_share;
      insert into public.site_analytics_daily (date, site_mode, device, visits)
      values (v_day, 'pre', v_devices[v_index], greatest(v_share, 0))
      on conflict (date, site_mode, path, source, device, city)
        do update set visits = excluded.visits;
      v_rows := v_rows + 1;
    end loop;

    -- Cidades
    v_remaining := v_visits;
    for v_index in 1..array_length(v_cities, 1) loop
      v_share := case
        when v_index = array_length(v_cities, 1) then v_remaining
        else round(v_visits * v_city_w[v_index] / 100.0)
      end;
      v_remaining := v_remaining - v_share;
      insert into public.site_analytics_daily (date, site_mode, city, visits)
      values (v_day, 'pre', v_cities[v_index], greatest(v_share, 0))
      on conflict (date, site_mode, path, source, device, city)
        do update set visits = excluded.visits;
      v_rows := v_rows + 1;
    end loop;
  end loop;

  return v_rows;
end;
$$;

-- Só o servidor. Uma função que escreve na tabela de tráfego não tem razão para
-- ser chamável por uma sessão, nem de admin — e o alvo do revoke é PUBLIC
-- (07 §21.9).
revoke all on function public.seed_demo_site_analytics(integer) from public;
revoke all on function public.seed_demo_site_analytics(integer) from anon;
revoke all on function public.seed_demo_site_analytics(integer) from authenticated;
grant execute on function public.seed_demo_site_analytics(integer) to service_role;

comment on function public.seed_demo_site_analytics(integer) is
  'Dados de demonstração para a revisão visual de /admin/trafego (P8-06). '
  'Determinística e idempotente. A importação do fornecedor substitui-os pelo '
  'upsert da chave única.';
