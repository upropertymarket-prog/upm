import { useTranslations } from "next-intl";
import {
  Bookmark,
  Building2,
  CalendarCheck,
  Eye,
  FileSignature,
  MessageSquare,
  PencilLine,
  Users,
} from "lucide-react";
import { Card } from "@upm/ui";

import type { DashboardStat, StatTone } from "./dashboardTypes";

const ICONS = {
  building: Building2,
  eye: Eye,
  draft: PencilLine,
  saved: Bookmark,
  leads: Users,
  visits: CalendarCheck,
  // Os dois últimos entram com o Painel do comprador (04 §2.4 · D33).
  messages: MessageSquare,
  contracts: FileSignature,
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
  const t = useTranslations("dashboard");
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
        {t("statsTitle")}
      </h2>
      <div
        style={{
          display: "grid",
          // Nunca uma coluna só (11 nov 2026): no telemóvel os quatro KPIs ficam
          // em 2 × 2 em vez de um por linha. A coluna mínima é metade da
          // largura até 210 px, e a partir daí fica tudo como antes (2, 3 ou 4
          // colunas). O 4.º termo deixa as quatro numa linha quando cabem.
          gridTemplateColumns:
            "repeat(auto-fit, minmax(max(calc((100% - 42px) / 4), min(calc((100% - 14px) / 2), 210px)), 1fr))",
          gap: 14,
        }}
      >
        {stats.map((stat) => {
          const Icon = ICONS[stat.icon];
          return (
            <Card key={stat.id} padded>
              {/* `upm-stat` / `upm-stat__label` (components.css): num cartão
                  estreito o ícone sobe para cima do rótulo. */}
              <div
                className="upm-stat"
                style={{ display: "flex", flexDirection: "column", gap: 9 }}
              >
                <span
                  className="upm-stat__label"
                  style={{
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
