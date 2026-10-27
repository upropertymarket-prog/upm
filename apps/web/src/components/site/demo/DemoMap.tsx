"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, StatusTag } from "@upm/ui";
import { DEMO_LISTINGS } from "@upm/ui/demo-data";

import { useDemoFormat } from "./format";

/**
 * Mapa da demonstração — 04 §8.4
 * =========================================================================
 * O Mapa do produto é o único ecrã a correr à largura toda (`contentWidth`
 * `"full"`, 04 §1.5): ali o conteúdo *é* a área visível. Aqui a área visível é
 * a caixa da demonstração, e é o que esta moldura ocupa.
 *
 * **Não é o Leaflet.** 07 §7 tirou a demonstração de qualquer dependência
 * externa, e uma camada de tiles vinda da internet seria um pedido de rede
 * feito por todos os que abrem a home — na página onde o AC de P2-06 mede
 * Lighthouse. O que se mostra é o que o Mapa faz: pinos com o preço, e o
 * cartão do imóvel ao clicar num. A malha de fundo está em `demo.css`.
 */
export function DemoMap() {
  const t = useTranslations("market");
  const tDeal = useTranslations("property.deal");
  const tDemo = useTranslations("site.demo");
  const format = useDemoFormat();
  const [activeId, setActiveId] = useState(DEMO_LISTINGS[0]!.id);
  const active = DEMO_LISTINGS.find((listing) => listing.id === activeId) ?? DEMO_LISTINGS[0]!;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      <div className="upm-demo-map">
        {DEMO_LISTINGS.map((listing) => {
          const selected = listing.id === active.id;
          return (
            <button
              key={listing.id}
              type="button"
              onClick={() => setActiveId(listing.id)}
              aria-pressed={selected}
              style={{
                position: "absolute",
                left: `${listing.pin.x}%`,
                top: `${listing.pin.y}%`,
                transform: "translate(-50%, -50%)",
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                padding: "var(--sp-2) var(--sp-4)",
                borderRadius: "var(--r-pill)",
                border: `1px solid ${selected ? "var(--accent-solid)" : "var(--border)"}`,
                background: selected ? "var(--accent-solid)" : "var(--surface)",
                color: selected ? "var(--on-solid)" : "var(--text)",
                font: "inherit",
                fontSize: "var(--fs-label)",
                fontWeight: "var(--fw-semibold)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {format.euro(listing.cents)}
            </button>
          );
        })}
      </div>

      <Card padded>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-5)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: "var(--sp-2)", minWidth: 0, flex: 1 }}>
            <strong style={{ fontSize: "var(--fs-body-lg)" }}>{active.title}</strong>
            <span style={{ color: "var(--muted)" }}>
              {active.typology} · {t("area", { value: active.area })} · {active.city}
            </span>
          </div>
          <StatusTag tone={active.deal === "sale" ? "dealSale" : "dealRent"}>
            {tDeal(active.deal)}
          </StatusTag>
          <strong style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-subtitle-lg)" }}>
            {format.euro(active.cents)}
          </strong>
        </div>
      </Card>

      <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--muted)" }}>
        {tDemo("mapNote")}
      </p>
    </div>
  );
}
