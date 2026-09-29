-- Localização do imóvel já como lon/lat, para o mapa compacto do detalhe
-- (market/[id]) — 03 F5 pedia "detalhe com localização aproximada", nunca
-- implementado (P4-04a só chamava `get_property_location` e descartava o
-- resultado). Fase 4, adenda a pedido do cliente (28 set 2026).
--
-- `security definer` (não invoker): tem de correr com os mesmos privilégios
-- de `get_property_location`, que já chama internamente — essa função lê
-- `properties`/`property_address_grants` diretamente e precisa de bypassar a
-- RLS do chamador (07 §1.2/§1.3), exatamente pelo mesmo motivo.
create or replace function public.property_location_point(p_property_id uuid)
returns table (
  lon double precision,
  lat double precision,
  is_exact boolean,
  radius_m integer
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_location extensions.geography;
  v_approx_radius_m integer;
begin
  select approx_radius_m into v_approx_radius_m
  from public.properties
  where id = p_property_id;

  if v_approx_radius_m is null then
    return;
  end if;

  v_location := public.get_property_location(p_property_id);
  if v_location is null then
    return;
  end if;

  return query select
    extensions.st_x(v_location::extensions.geometry),
    extensions.st_y(v_location::extensions.geometry),
    -- É a exata quando coincide com a coluna privada `location` — só o dono/
    -- staff/grant/`show_exact` a recebem (mesma regra de `get_property_location`).
    v_location = (select p.location from public.properties p where p.id = p_property_id),
    v_approx_radius_m;
end;
$$;

comment on function public.property_location_point(uuid) is
  'Localização de um imóvel já como lon/lat (exata ou aproximada conforme 07 §1.2), para o mapa compacto do detalhe (market/[id]).';
