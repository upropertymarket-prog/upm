import { Bookmark, Building2, Eye, PencilLine } from "lucide-react";
import { Card } from "@upm/ui";

import type { DashboardStat, StatTone } from "./dashboardTypes";

const ICONS = {
  building: Building2,
  eye: Eye,
  draft: PencilLine,
  saved: Bookmark,
} as const;

const TONE: Record<StatTone, string> = {
  ok: "var(--ok)",
  warn: "var(--warn)",
  muted: "var(--muted)",
};

/**
 * "As suas estatísticas" (P4-06) — a fila de KPIs no topo do Painel, 04 §8.3.
 *
 * Quatro cartões de Fase 4. O desenho original tem "Leads novas" e "Visitas
 * agendadas" nos dois últimos lugares, mas essas tabelas só nascem na Fase 5
 * (P5-02 · P5-03); até lá o lugar é de "Rascunhos" e "Guardados por
 * compradores", que já têm dados reais. Trocar de volta é mudar o que o
 * `painel/page.tsx` calcula — este componente não sabe nada disso.
 */
export function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2
        style={{
          fontSize: "var(--fs-subtitle)",
          fontWeight: "var(--fw-bold)",
          color: "var(--text)",
          margin: 0,
        }}
      >
        As suas estatísticas
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 14,
        }}
      >
        {stats.map((stat) => {
          const Icon = ICONS[stat.icon];
          return (
            <Card key={stat.id} padded>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "var(--fs-label)",
                    fontWeight: "var(--fw-semibold)",
                    color: "var(--muted)",
                  }}
                >
                  <Icon size={15} color="var(--accent)" aria-hidden="true" />
                  {stat.label}
                </span>
                <strong
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--fs-title)",
                    fontWeight: "var(--fw-bold)",
                    color: "var(--text)",
                  }}
                >
                  {stat.value}
                </strong>
                <span style={{ fontSize: "var(--fs-label)", color: TONE[stat.deltaTone] }}>
                  {stat.delta}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
