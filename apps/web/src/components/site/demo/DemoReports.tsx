"use client";

import { useTranslations } from "next-intl";
import { Card, StatusTag, type StatusTone } from "@upm/ui";
import { DEMO_REPORTS, type DemoReport } from "@upm/ui/demo-data";

import { useDemoFormat } from "./format";

/**
 * "Os meus reports" da demonstração — 04 §2.7 #6 · 07 §5.11
 * =========================================================================
 * A timeline de `ReportsTimeline`, com os cinco passos em linguagem simples e
 * **nenhum facto técnico** — que no produto não é uma escolha do ecrã mas uma
 * garantia da base de dados (`my_reports()` não devolve `breadcrumbs` nem
 * `fingerprint`). Aqui não há base de dados; o que se mantém é a promessa que
 * o ecrã faz a quem reporta: vê-se onde está e quanto falta.
 *
 * Os passos mostram-se todos, com o atual assinalado — a razão está no
 * original: um estado isolado ("Em teste") diz onde está e não diz quanto
 * falta.
 */

const STEPS: DemoReport["status"][] = [
  "new",
  "triage",
  "in_progress",
  "awaiting_confirmation",
  "closed",
];

const STEP_KEY: Record<DemoReport["status"], string> = {
  new: "received",
  triage: "analysing",
  in_progress: "fixing",
  awaiting_confirmation: "testing",
  closed: "resolved",
};

const STATUS_TONE: Record<DemoReport["status"], StatusTone> = {
  new: "ticketNew",
  triage: "ticketTriage",
  in_progress: "ticketProgress",
  awaiting_confirmation: "ticketAwaiting",
  closed: "ticketClosed",
};

export function DemoReports() {
  const t = useTranslations("support.myReports");
  const tDemo = useTranslations("site.demo.reports");
  const format = useDemoFormat();

  return (
    <div style={{ display: "grid", gap: "var(--sp-5)" }}>
      {DEMO_REPORTS.map((report) => {
        const currentIndex = STEPS.indexOf(report.status);
        return (
          <Card key={report.id} padded>
            <article style={{ display: "grid", gap: "var(--sp-4)" }}>
              <header style={{ display: "grid", gap: "var(--sp-2)" }}>
                <span
                  style={{
                    display: "flex",
                    gap: "var(--sp-3)",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <code style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
                    {report.ref}
                  </code>
                  <StatusTag tone={STATUS_TONE[report.status]}>
                    {t(`steps.${STEP_KEY[report.status]}`)}
                  </StatusTag>
                  <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
                    {format.date(format.at(-report.daysAgo))}
                  </span>
                </span>
                <h2 style={{ margin: 0, fontSize: "var(--fs-body-lg)", color: "var(--text)" }}>
                  {tDemo(report.titleKey)}
                </h2>
              </header>

              <ol
                aria-label={t("progressLabel")}
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--sp-2) var(--sp-4)",
                  fontSize: "var(--fs-label)",
                }}
              >
                {STEPS.map((step, index) => {
                  const done = index <= currentIndex;
                  return (
                    <li
                      key={step}
                      aria-current={index === currentIndex ? "step" : undefined}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "var(--sp-2)",
                        color: done ? "var(--text)" : "var(--muted)",
                        fontWeight: index === currentIndex ? "var(--fw-bold)" : "var(--fw-regular)",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "var(--r-pill)",
                          background: done ? "var(--accent)" : "var(--border2)",
                        }}
                      />
                      {t(`steps.${STEP_KEY[step]}`)}
                    </li>
                  );
                })}
              </ol>

              {report.fixNoteKey ? (
                <section
                  style={{
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)",
                    padding: "var(--sp-4)",
                    display: "grid",
                    gap: "var(--sp-2)",
                  }}
                >
                  <strong style={{ fontSize: "var(--fs-label)" }}>{t("fixNoteTitle")}</strong>
                  <p style={{ margin: 0, lineHeight: 1.55 }}>{tDemo(report.fixNoteKey)}</p>
                </section>
              ) : null}
            </article>
          </Card>
        );
      })}
    </div>
  );
}
