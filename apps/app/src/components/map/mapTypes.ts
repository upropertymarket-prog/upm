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

/** `[oeste, sul, este, norte]`, em graus — a área visível do mapa. */
export type MapBounds = [number, number, number, number];

export type ViewportAction = (bounds: MapBounds) => Promise<MapProperty[]>;

/**
 * Quantos pontos o mapa pede de cada vez, e o teto do PostgREST (`max_rows`).
 * Uma resposta com este tamanho quer dizer que há mais: o ecrã diz isso em vez
 * de mostrar um mapa que parece completo (3 nov 2026 — antes carregava "todos"
 * os imóveis, e acima dos 1000 os restantes desapareciam sem aviso).
 */
export const MAP_CAP = 1000;

/** Estilo keyless do OpenFreeMap — sem chave de API (07 §16.5, prática já seguida no resto do projeto). */
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
