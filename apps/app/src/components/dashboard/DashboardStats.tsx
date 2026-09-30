import { Bookmark, Building2, CalendarCheck, Eye, PencilLine, Users } from "lucide-react";
import { Card } from "@upm/ui";

import type { DashboardStat, StatTone } from "./dashboardTypes";

const ICONS = {
  building: Building2,
  eye: Eye,
  draft: PencilLine,
  saved: Bookmark,
  leads: Users,
  visits: CalendarCheck,
} as const;

const TONE: Record<StatTone, string> = {
  ok: "var(--ok)",
  warn: "var(--warn)",
  muted: "var(--muted)",
};

/**
 * "As suas estatísticas" (P4-06) — a fila de KPIs no topo do Painel, 04 §8.3.
 *
 * Os quatro KPIs do desenho. Na Fase 4 os dois últimos lugares eram ocupados
 * por "Rascunhos" e "Guardados por compradores", porque `owner_leads` e
 * `visit_requests` ainda não existiam; com a Fase 5 voltaram a ser "Leads
 * novas" e "Visitas agendadas". Quem escolhe é o `painel/page.tsx` — este
 * componente só desenha o que recebe.
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
