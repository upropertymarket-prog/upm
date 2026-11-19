import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
import { INTL_LOCALE, resolveLocale } from "@upm/config";
import { Card, EmptyState } from "@upm/ui";

import { formatDay, formatTime, type VisitRow } from "../interaction/interactionTypes";

export type UpcomingVisitsProps = {
  rows: VisitRow[];
};

/**
 * "Próximas visitas" (D23) — 04 §8.3, bloco da direita de "Gráficos"
 * =========================================================================
 * Ficou por construir na Fase 4 por depender de `visit_requests` (08 §9,
 * adenda 2). Entra agora ao lado do gráfico, na grelha de duas colunas que a
 * referência desenha — não por baixo, e não a toda a largura.
 *
 * Como o resto do Painel, recebe as linhas prontas: quem as vai buscar é o
 * `painel/page.tsx`.
 */
export function UpcomingVisits({ rows }: UpcomingVisitsProps) {
  const t = useTranslations("visits.upcoming");
  const intlLocale = INTL_LOCALE[resolveLocale(useLocale())];
  return (
    <Card padded style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
        <CalendarDays size={16} aria-hidden="true" color="var(--accent)" />
        <strong style={{ fontSize: "var(--fs-body-lg)" }}>{t("title")}</strong>
        <Link href="/agenda" style={{ marginLeft: "auto", fontWeight: "var(--fw-bold)" }}>
          {t("seeSchedule")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <ul
          style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--sp-4)" }}
        >
          {rows.map((row) => {
            const { day, month } = formatDay(row.proposedAt, intlLocale);
            return (
              <li
                key={row.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--sp-5)",
                  padding: "var(--sp-5)",
                  borderRadius: "var(--r-xl)",
                  border: "1px solid var(--border)",
                  background: "var(--surface2)",
                  minWidth: 0,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 48,
                    flex: "none",
                    padding: "var(--sp-2) 0",
                    borderRadius: "var(--r-md)",
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                  }}
                >
                  <strong style={{ fontSize: "var(--fs-subtitle)", lineHeight: 1 }}>{day}</strong>
                  <span
                    style={{
                      fontSize: "var(--fs-label)",
                      fontWeight: "var(--fw-black)",
                      textTransform: "uppercase",
                    }}
                  >
                    {month}
                  </span>
                </span>
                <span style={{ display: "grid", gap: "var(--sp-1)", minWidth: 0, flex: 1 }}>
                  <strong
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Visita · {row.propertyTitle}
                  </strong>
                  <span
                    style={{
                      color: "var(--muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.other.name} · {row.status === "accepted" ? "confirmada" : "por confirmar"}
                  </span>
                </span>
                <span
                  style={{
                    fontWeight: "var(--fw-black)",
                    color: "var(--accent)",
                    flex: "none",
                  }}
                >
                  {formatTime(row.proposedAt, intlLocale)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
