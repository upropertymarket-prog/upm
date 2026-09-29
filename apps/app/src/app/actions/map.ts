"use server";

import { cookies } from "next/headers";
import { createClient } from "@upm/db/server";

import type { MapProperty } from "../../components/map/mapTypes";

export type { MapProperty };

/**
 * Imóveis dentro de um polígono desenhado no Mapa (P4-05).
 *
 * Chama `properties_within_polygon`, criada na migração
 * `supabase/migrations/20260928100200_properties_within_polygon.sql` — essa
 * função ainda não foi aplicada à base de dados (o utilizador principal
 * revê o SQL antes), por isso `database.types.ts` ainda não a conhece: o
 * `rpc` sai daqui tipado à mão via um cast local, não com `any` solto.
 */
export async function propertiesWithinPolygon(
  coordinates: [number, number][],
): Promise<MapProperty[]> {
  if (coordinates.length < 3) return [];

  const supabase = createClient(await cookies());
  const geojson = {
    type: "Polygon",
    coordinates: [[...coordinates, coordinates[0]]],
  };

  const rpc = supabase.rpc as unknown as (
    fn: "properties_within_polygon",
    args: { p_geojson: typeof geojson },
  ) => Promise<{ data: MapProperty[] | null; error: unknown }>;

  const { data, error } = await rpc("properties_within_polygon", { p_geojson: geojson });
  if (error || !data) return [];
  return data;
}
