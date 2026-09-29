-- Imóveis dentro de um polígono desenhado no Mapa (P4-05).
-- =============================================================================
-- Mesma regra crítica de RLS das restantes funções públicas de imóveis: lê
-- sempre `properties_public` (nunca `properties` direto), por isso pode ser
-- `security invoker` em vez de `security definer` — a view já filtra por
-- `status in ('active','featured')` e não expõe `location`/`address_line`.
--
-- NOTA: ficheiro só escrito nesta fase — não aplicado (`db push`) por este
-- agente. O utilizador principal revê o SQL e aplica-o depois.
create or replace function public.properties_within_polygon(p_geojson jsonb)
returns table (
  id uuid,
  lon double precision,
  lat double precision,
  price_cents bigint,
  deal public.property_deal,
  title text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    pp.id,
    extensions.st_x(pp.location_approx::extensions.geometry),
    extensions.st_y(pp.location_approx::extensions.geometry),
    coalesce(pp.price_cents, pp.rent_cents),
    pp.deal,
    pp.title
  from public.properties_public pp
  where pp.location_approx is not null
    and extensions.st_within(
      pp.location_approx::extensions.geometry,
      extensions.st_geomfromgeojson(p_geojson::text)
    );
$$;

comment on function public.properties_within_polygon(jsonb) is
  'Imóveis públicos (properties_public) cujo location_approx cai dentro do polígono GeoJSON dado — usado pelo desenho de área do Mapa (P4-05).';
