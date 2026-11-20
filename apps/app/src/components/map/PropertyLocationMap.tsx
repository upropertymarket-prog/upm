"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { MAP_STYLE } from "./mapTypes";

export type PropertyLocationMapProps = {
  lon: number;
  lat: number;
  /** `false` → é a aproximada: desenha o círculo de raio, não um pin exato (07 §1.2). */
  isExact: boolean;
  radiusM: number;
  style?: React.CSSProperties;
};

/**
 * Mapa compacto do detalhe de um imóvel (market/[id]) — 03 F5 pedia "detalhe
 * com localização aproximada", nunca implementado (P4-04a chamava
 * `get_property_location` e descartava o resultado). Sem clusters nem
 * desenho de área — isso é o Mapa de busca (P4-05, `PropertyMap`), uma
 * página à parte, que continua a existir para procurar entre vários imóveis.
 * Este é só um ponto (ou círculo) para ESTE imóvel.
 */
export function PropertyLocationMap({
  lon,
  lat,
  isExact,
  radiusM,
  style,
}: PropertyLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hasExplicitHeight = style?.height !== undefined;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [lon, lat],
      zoom: isExact ? 15 : 13,
      interactive: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      if (isExact) {
        new maplibregl.Marker({ color: "#f97316" }).setLngLat([lon, lat]).addTo(map);
        return;
      }

      map.addSource("upm-approx", {
        type: "geojson",
        data: { type: "Point", coordinates: [lon, lat] },
      });
      map.addLayer({
        id: "upm-approx-circle",
        type: "circle",
        source: "upm-approx",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, radiusM / 60, 16, radiusM / 2],
          "circle-color": "#f97316",
          "circle-opacity": 0.2,
          "circle-stroke-color": "#f97316",
          "circle-stroke-width": 2,
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só inicializa uma vez, por localização.
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: hasExplicitHeight ? undefined : 220,
          flex: hasExplicitHeight ? "1 1 auto" : undefined,
          minHeight: hasExplicitHeight ? 0 : undefined,
          borderRadius: 12,
          overflow: "hidden",
        }}
      />
      {!isExact ? (
        <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)", textAlign: "center" }}>
          Localização aproximada — a morada exata é partilhada pelo proprietário após aceitar uma
          visita ou pedido de contacto.
        </span>
      ) : null}
    </div>
  );
}
