"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Card, Tabs } from "@upm/ui";

import type { ViewsSeries } from "./dashboardTypes";

const PLOT_HEIGHT = 180;
/** Altura mínima de uma barra, para que um dia com poucas visitas ainda se veja. */
const MIN_BAR = 18;

/**
 * "Visitas às propriedades" (P4-06) — o gráfico do Painel, 04 §8.3.
 * =========================================================================
 * Uma série só (visualizações agregadas de `property_views`), logo sem legenda:
 * o título nomeia-a. A última barra de cada intervalo é o período em curso e é
 * a única a `--accent`; as restantes ficam em `--surface3` para não competirem.
 *
 * Os três intervalos são o `Tabs` do design system — 07 §4 diz que tabs servem
 * para filtrar dentro de um ecrã, que é exatamente isto.
 *
 * Alternativa não visual: a tabela em `.upm-sr-only` a seguir ao gráfico, para
 * quem não lê as barras.
 */
export function ViewsChart({
  series,
  /**
   * O título nomeia a série, por isso muda com quem olha: o proprietário vê as
   * visitas aos imóveis dele, o comprador vê os imóveis que viu (04 §2.4).
   */
  title,
}: {
  series: ViewsSeries[];
  /** Por omissão, as visitas aos imóveis do proprietário. */
  title?: string;
}) {
  const t = useTranslations("dashboard");
  const [rangeId, setRangeId] = useState(series[0]?.id ?? "");
  const active = series.find((s) => s.id === rangeId) ?? series[0];
  const buckets = active?.buckets ?? [];
  const max = buckets.reduce((acc, bucket) => Math.max(acc, bucket.value), 1);

  return (
    <Card padded>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 className="upm-card__title" style={{ margin: 0 }}>
            {title ?? t("viewsTitle")}
          </h3>
          <div style={{ marginLeft: "auto" }}>
            <Tabs
              label={t("chartRange")}
              items={series.map((s) => ({ id: s.id, label: s.label }))}
              value={active?.id ?? ""}
              onValueChange={setRangeId}
            />
          </div>
        </div>

        <div
          aria-hidden="true"
          style={{ display: "flex", alignItems: "flex-end", gap: 10, height: PLOT_HEIGHT }}
        >
          {buckets.map((bucket, index) => {
            const last = index === buckets.length - 1;
            return (
              <div
                key={bucket.label}
                title={bucket.srLabel}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 7,
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--fs-label)",
                    fontWeight: "var(--fw-bold)",
                    color: last ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  {bucket.value.toLocaleString("pt-PT")}
                </span>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 40,
                    height: Math.round(MIN_BAR + (bucket.value / max) * (PLOT_HEIGHT - 62)),
                    borderRadius: "8px 8px 4px 4px",
                    background: last ? "var(--accent)" : "var(--surface3)",
                  }}
                />
                <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
                  {bucket.label}
                </span>
              </div>
            );
          })}
        </div>

        <table className="upm-sr-only">
          <caption>
            {title} por período ({active?.label})
          </caption>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.label}>
                <th scope="row">{bucket.srLabel}</th>
                <td>{bucket.value.toLocaleString("pt-PT")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
