/**
 * Tipos partilhados do Mapa (P4-05) — ficheiro sem `"use server"`, de
 * propósito: `actions/map.ts` importa `next/headers` e importar esse módulo
 * (mesmo só por um tipo) partiria a compilação de qualquer canvas que
 * renderize `PropertyMap` (mesmo padrão de `LoginState` em `LoginForm.tsx`).
 */
export type MapProperty = {
  id: string;
  lon: number;
  lat: number;
  price_cents: number;
  deal: "sale" | "rent";
  title: string;
};

export type DrawPolygonAction = (coordinates: [number, number][]) => Promise<MapProperty[]>;

/** Estilo keyless do OpenFreeMap — sem chave de API (07 §16.5, prática já seguida no resto do projeto). */
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
