-- UProperty Market — Fase 8 (Admin), P8-06
--
-- `seed_demo_site_analytics()` sem as variáveis que sombreavam as do ciclo.
--
-- O `gate:db` da migração anterior passou (são avisos, e o portão falha só em
-- erros) mas deixou **sete avisos novos** num schema que vinha a dar "No schema
-- errors found" em todas as fases. Um portão que começa a imprimir avisos
-- aceitáveis deixa de servir para detetar os inaceitáveis.
--
-- A causa: em PL/pgSQL, `for v_index in 1..n` **declara a sua própria** variável
-- inteira. As que eu declarei no `declare` ficaram por usar, e as do ciclo a
-- sombrear-lhes o nome. Saem as duas declarações; o corpo é o mesmo.
--
-- Migração própria porque a anterior já estava aplicada em staging (07 §20.7).

create or replace function public.seed_demo_site_analytics(p_days integer default 45)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
  v_visits bigint;
  v_remaining bigint;
  v_share bigint;
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
