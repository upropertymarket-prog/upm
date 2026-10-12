"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

// A folha de estilo do maplibre, servida da nossa origem. É estática e não um
// `import()` dentro do efeito por duas razões: o `import()` de um `.css` não
// tem tipos (TS2307), e um `<link>` para um CDN meteria **outro** terceiro
// numa página que este componente existe para manter livre deles — além de
// contrariar o self-hosting que o projeto já aplica às fontes. O custo são
// ~20 KB de CSS no pedaço desta rota; o maplibre em si (~200 KB de JS)
// continua a só carregar ao clique.
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Localização aproximada no site público (P2-05 · 04 §2.1 · 07 §1.2)
 * =========================================================================
 * **Carrega só quando o visitante pede.** O mapa é desenhado com tiles do
 * OpenFreeMap — sem chave de API, mas ainda assim um terceiro que passa a ver
 * o IP de quem abre a página. Na app autenticada isso já acontece e está
 * aceite; no site público seria um pedido a um terceiro **antes de qualquer
 * consentimento**, e §3 da Política de Cookies afirma hoje que o site não tem
 * nenhum. Um clique explícito resolve as duas coisas ao mesmo tempo: nada sai
 * do browser sem o visitante o pedir, e o Lighthouse de 04 §2.1 AC não paga
 * 200 KB de mapa em cada visita a uma ficha.
 *
 * **Não é o `PropertyLocationMap` da app, e não é uma cópia dele.** Aquele
 * tem dois modos, porque na app a morada exata existe para quem o proprietário
 * autorizou: desenha um pin quando é exata e um círculo quando não é. Aqui o
 * modo exato **não pode existir** — `properties_public` não expõe `location`
 * (08 §2.7), e por isso a coordenada exata nunca chega a este componente. O
 * contrato é mais estreito de propósito: sempre o círculo, nunca interativo,
 * nunca um pin. Partilhar o componente da app seria arrastar para o site
 * público um caminho de código que mostra moradas exatas — exatamente o que a
 * view existe para impedir.
 *
 * O `import()` é dinâmico para o maplibre não entrar no bundle da página: numa
 * ficha que ninguém abriu o mapa, o custo é zero.
 */
export function ListingMap({
  lon,
  lat,
  radiusM,
}: {
  lon: number;
  lat: number;
  /** Raio da zona aproximada. Sem valor declarado, 500 m — o que 07 §1.2 usa. */
  radiusM: number | null;
}) {
  const [active, setActive] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const radius = radiusM && radiusM > 0 ? radiusM : 500;

  useEffect(() => {
    if (!active || !containerRef.current) return;
    const container = containerRef.current;
    let map: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      // O visitante pode ter fechado a secção enquanto o módulo carregava.
      if (cancelled) return;

      const instance = new maplibregl.Map({
        container,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [lon, lat],
        zoom: 13,
        // Não interativo: isto situa o imóvel, não é a página do Mapa. Também
        // evita que o gesto de scroll do telemóvel fique preso no mapa.
        interactive: false,
        attributionControl: { compact: true },
      });
      map = instance;

      instance.on("load", () => {
        instance.addSource("upm-approx", {
          type: "geojson",
          data: { type: "Point", coordinates: [lon, lat] },
        });
        instance.addLayer({
          id: "upm-approx-circle",
          type: "circle",
          source: "upm-approx",
          // Cores fixas e não tokens: as propriedades de pintura do maplibre
          // são lidas pelo WebGL, não pelo CSS, e não resolvem `var()`. É o
          // mesmo valor de `--accent` do tema escuro, como no mapa da app.
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, radius / 60, 16, radius / 2],
            "circle-color": "#f97316",
            "circle-opacity": 0.2,
            "circle-stroke-color": "#f97316",
            "circle-stroke-width": 2,
          },
        });
      });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [active, lon, lat, radius]);

  return (
    <div style={{ display: "grid", gap: "var(--sp-3)" }}>
      <div
        style={{
          position: "relative",
          height: 280,
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border)",
          background: "var(--surface2)",
          overflow: "hidden",
        }}
      >
        {active ? (
          <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              gap: "var(--sp-4)",
              padding: "var(--sp-5)",
              textAlign: "center",
            }}
          >
            <div style={{ display: "grid", gap: "var(--sp-3)", justifyItems: "center" }}>
              <MapPin size={24} aria-hidden="true" style={{ color: "var(--muted)" }} />
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--fs-body)",
                  color: "var(--muted)",
                  maxWidth: "26rem",
                }}
              >
                O mapa é carregado do OpenFreeMap. Ao abri-lo, o seu endereço IP fica visível para
                esse serviço.
              </p>
              <button
                type="button"
                className="upm-btn upm-btn--secondary upm-btn--md"
                onClick={() => setActive(true)}
              >
                Ver no mapa
              </button>
            </div>
          </div>
        )}
      </div>

      <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
        Localização aproximada — a morada exata é partilhada pelo proprietário depois de aceitar um
        pedido de visita ou de contacto.
      </span>
    </div>
  );
}
