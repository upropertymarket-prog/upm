"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import * as maplibregl from "maplibre-gl";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button } from "@upm/ui";

import { MAP_STYLE, type DrawPolygonAction, type MapProperty } from "./mapTypes";
import { formatCents } from "../../lib/money";

/** Centróide aproximado de Portugal continental. */
const PT_CENTER: [number, number] = [-8.5, 39.5];

const POINTS_SOURCE = "upm-properties";
const DRAW_SOURCE = "upm-draw";

function toFeatureCollection(properties: MapProperty[]) {
  return {
    type: "FeatureCollection" as const,
    features: properties.map((property) => ({
      type: "Feature" as const,
      properties: {
        id: property.id,
        price_cents: property.price_cents,
        deal: property.deal,
        title: property.title,
      },
      geometry: { type: "Point" as const, coordinates: [property.lon, property.lat] },
    })),
  };
}

function drawFeatureCollection(vertices: [number, number][]) {
  return {
    type: "FeatureCollection" as const,
    features:
      vertices.length >= 2
        ? [
            {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: vertices.length >= 3 ? ("Polygon" as const) : ("LineString" as const),
                coordinates: vertices.length >= 3 ? [[...vertices, vertices[0]]] : vertices,
              },
            },
          ]
        : [],
  };
}

export type PropertyMapProps = {
  initialProperties: MapProperty[];
  /**
   * Server Action `propertiesWithinPolygon` de `actions/map.ts`, injetada
   * pela página — nunca importada aqui diretamente (mesma regra de
   * canvas-safety do resto do projeto: a action puxa `next/headers`).
   */
  onDrawPolygon: DrawPolygonAction;
};

/**
 * Mapa de imóveis (P4-05) — MapLibre GL, clusters, popup e desenho de área.
 * =========================================================================
 * "Desenhar área": clique acrescenta vértices, duplo clique fecha o polígono
 * e chama `onDrawPolygon`, que substitui os pontos mostrados pelo resultado
 * dentro da área.
 */
export function PropertyMap({ initialProperties, onDrawPolygon }: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawingRef = useRef(false);
  const verticesRef = useRef<[number, number][]>([]);
  const [drawing, setDrawing] = useState(false);
  const [loading, setLoading] = useState(false);
  const t = useTranslations("market");

  /**
   * O popup do maplibre monta-se dentro do `useEffect` que cria o mapa, que
   * corre uma vez (`[]`). Guardar o rótulo num ref em vez de o fechar na
   * closure é o que faz o handler ler sempre o valor atual, sem acrescentar o
   * `t` às dependências e remontar o mapa inteiro a cada renderização.
   */
  const viewPropertyLabelRef = useRef(t("viewProperty"));
  viewPropertyLabelRef.current = t("viewProperty");

  const setPoints = useCallback((properties: MapProperty[]) => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(POINTS_SOURCE) as GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(properties) as never);
  }, []);

  const setDraw = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(DRAW_SOURCE) as GeoJSONSource | undefined;
    source?.setData(drawFeatureCollection(verticesRef.current) as never);
  }, []);

  const finishPolygon = useCallback(async () => {
    drawingRef.current = false;
    setDrawing(false);
    const vertices = verticesRef.current;
    if (vertices.length < 3) {
      verticesRef.current = [];
      setDraw();
      return;
    }
    setLoading(true);
    try {
      const result = await onDrawPolygon(vertices);
      setPoints(result);
    } finally {
      setLoading(false);
    }
  }, [setDraw, setPoints, onDrawPolygon]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: PT_CENTER,
      zoom: 6,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource(POINTS_SOURCE, {
        type: "geojson",
        data: toFeatureCollection(initialProperties) as never,
        cluster: true,
        clusterRadius: 50,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: POINTS_SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#f97316",
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 28],
          "circle-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: POINTS_SOURCE,
        filter: ["has", "point_count"],
        layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 },
        paint: { "text-color": "#fff" },
      });
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: POINTS_SOURCE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#f97316",
          "circle-radius": 8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });

      map.addSource(DRAW_SOURCE, {
        type: "geojson",
        data: drawFeatureCollection([]) as never,
      });
      map.addLayer({
        id: "draw-fill",
        type: "fill",
        source: DRAW_SOURCE,
        filter: ["==", "$type", "Polygon"],
        paint: { "fill-color": "#f97316", "fill-opacity": 0.15 },
      });
      map.addLayer({
        id: "draw-line",
        type: "line",
        source: DRAW_SOURCE,
        paint: { "line-color": "#f97316", "line-width": 2 },
      });

      map.on("click", "unclustered-point", (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const [lon, lat] = feature.geometry.coordinates as [number, number];
        const price = formatCents(Number(feature.properties?.price_cents));
        const title = String(feature.properties?.title ?? "");
        const id = String(feature.properties?.id ?? "");
        new maplibregl.Popup()
          .setLngLat([lon, lat])
          .setHTML(
            `<strong>${title}</strong><br/>${price}<br/><a href="/market/${id}">${viewPropertyLabelRef.current}</a>`,
          )
          .addTo(map);
      });

      map.on("click", (event: MapMouseEvent) => {
        if (!drawingRef.current) return;
        // Não acrescenta vértice quando o clique acertou num ponto/cluster —
        // esses já têm o próprio handler acima.
        const hits = map.queryRenderedFeatures(event.point, {
          layers: ["unclustered-point", "clusters"],
        });
        if (hits.length > 0) return;
        verticesRef.current = [...verticesRef.current, [event.lngLat.lng, event.lngLat.lat]];
        setDraw();
      });

      map.on("dblclick", () => {
        if (!drawingRef.current) return;
        void finishPolygon();
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só inicializa uma vez.
  }, []);

  const toggleDrawing = () => {
    if (drawingRef.current) {
      void finishPolygon();
      return;
    }
    verticesRef.current = [];
    setDraw();
    drawingRef.current = true;
    setDrawing(true);
    if (mapRef.current) mapRef.current.doubleClickZoom.disable();
  };

  useEffect(() => {
    if (!drawing && mapRef.current) mapRef.current.doubleClickZoom.enable();
  }, [drawing]);

  const resetArea = () => {
    verticesRef.current = [];
    setDraw();
    setPoints(initialProperties);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          variant={drawing ? "secondary" : "primary"}
          onClick={toggleDrawing}
          disabled={loading}
        >
          {drawing ? "Fechar área (duplo clique no mapa)" : "Desenhar área"}
        </Button>
        <Button variant="ghost" onClick={resetArea} disabled={loading}>
          Limpar
        </Button>
      </div>
      {/*
        A altura acompanha o ecrã em vez de ficar nos 560 px fixos: agora que o
        Mapa corre a toda a largura (04 §1.5), uma altura fixa dava uma faixa
        muito achatada num monitor grande. Os 260 px descontados são o que a
        topbar, o padding do shell, o título e a barra de ações ocupam por cima.
        O `clamp` trava nos extremos — nunca abaixo de 420 px num portátil
        pequeno, nunca acima de 900 px num ecrã muito alto.
      */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "clamp(420px, calc(100vh - 260px), 900px)",
          borderRadius: 16,
        }}
      />
    </div>
  );
}
