"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@upm/db/server";

import { MAP_CAP, type MapBounds, type MapProperty } from "../../components/map/mapTypes";

export type { MapProperty };

/**
 * Imóveis dentro de um polígono desenhado no Mapa (P4-05).
 *
 * Chama `properties_within_polygon` (20260928100200). Pede no máximo
 * `MAP_CAP`; o ecrã lê uma resposta desse tamanho como "há mais".
 */
export async function propertiesWithinPolygon(
  coordinates: [number, number][],
): Promise<MapProperty[]> {
  if (coordinates.length < 3) return [];

  const supabase = createClient(await cookies());
  const geojson = {
    type: "Polygon",
    coordinates: [[...coordinates, coordinates[0]!]],
  };

  const { data, error } = await supabase
    .rpc("properties_within_polygon", { p_geojson: geojson })
    .limit(MAP_CAP);
  if (error || !data) return [];
  return data as MapProperty[];
}

const boundsSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

/**
 * Imóveis na área visível do Mapa (3 nov 2026).
 * =========================================================================
 * Até aqui a página carregava todos os imóveis de uma vez, "porque o dataset
 * é pequeno". Era pequeno; não vai ser. Cada visita lia a tabela inteira, e
 * acima dos 1000 o PostgREST cortava sem aviso. Agora pede-se só o que se vê,
 * a cada movimento do mapa, com o mesmo teto explícito.
 */
export async function propertiesInBounds(bounds: MapBounds): Promise<MapProperty[]> {
  const parsed = boundsSchema.safeParse(bounds);
  if (!parsed.success) return [];
  const [minLon, minLat, maxLon, maxLat] = parsed.data;

  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .rpc("properties_for_map", {
      p_min_lon: minLon,
      p_min_lat: minLat,
      p_max_lon: maxLon,
      p_max_lat: maxLat,
    })
    .limit(MAP_CAP);
  if (error || !data) return [];
  return data;
}
