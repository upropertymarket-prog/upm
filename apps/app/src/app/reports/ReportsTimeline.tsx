"use client";

import { useTranslations } from "next-intl";
import { Card, EmptyState, PageHeader, StatusTag, type StatusTone } from "@upm/ui";
import { REPORTER_TIMELINE, type MyReportRow, type TicketStatus } from "@upm/db/support";

/**
 * "Os meus reports" — a timeline em linguagem simples (04 §2.7 #6)
 * =========================================================================
 * Os cinco passos de 07 §5.11, e nada do vocabulário interno: quem reportou lê
 * "Em análise", não `triage`. O mapeamento vive em `REPORTER_TIMELINE`, no
 * mesmo ficheiro que as tabs do Suporte, para que as duas leituras do mesmo
 * `status` não possam divergir.
 *
 * Os passos mostram-se **todos**, com o atual assinalado e os seguintes
 * esbatidos — não só o atual. Quem reportou um problema quer saber não só onde
 * está, mas quanto falta: um estado isolado ("Em teste") não responde à
 * segunda pergunta.
 */

const STEPS: TicketStatus[] = ["new", "triage", "in_progress", "awaiting_confirmation", "closed"];

const STATUS_TONE: Record<TicketStatus, StatusTone> = {
  new: "ticketNew",
  triage: "ticketTriage",
  in_progress: "ticketProgress",
  awaiting_confirmation: "ticketAwaiting",
  closed: "ticketClosed",
};

export function ReportsTimeline({ reports, locale }: { reports: MyReportRow[]; locale: string }) {
  const t = useTranslations("support.myReports");
  const dateFormat = new Intl.DateTimeFormat(locale === "en" ? "en-IE" : "pt-PT", {
    dateStyle: "medium",
  });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {reports.length === 0 ? (
        <Card padded>
          <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />
        </Card>
      ) : (
        <div style={{ display: "grid", gap: "var(--sp-5)" }}>
          {reports.map((report) => {
            const currentIndex = STEPS.indexOf(report.status);
            return (
              <Card key={report.id} padded>
                <article style={{ display: "grid", gap: "var(--sp-4)" }}>
                  <header style={{ display: "grid", gap: "var(--sp-2)" }}>
                    <span
                      style={{
                        display: "flex",
                        gap: "var(--sp-2)",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <code style={{ fontSize: "12px", color: "var(--muted)" }}>{report.ref}</code>
                      <StatusTag tone={STATUS_TONE[report.status]}>
                        {t(`steps.${REPORTER_TIMELINE[report.status]}`)}
                      </StatusTag>
                      <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>
                        {dateFormat.format(new Date(report.created_at))}
                      </span>
                    </span>
                    <h2 style={{ margin: 0, fontSize: "15px", color: "var(--text)" }}>
                      {report.title}
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
                      fontSize: "13px",
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
                            fontWeight: index === currentIndex ? 700 : 400,
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "var(--r-pill)",
                              background: done ? "var(--accent)" : "var(--border2)",
                            }}
                          />
                          {t(`steps.${REPORTER_TIMELINE[step]}`)}
                        </li>
                      );
                    })}
                  </ol>

                  {/* 04 §2.7 #5: o texto "o que foi corrigido" é para ser lido
                      por quem reportou — é o fecho da conversa. */}
                  {report.fix_note ? (
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
                      <strong style={{ fontSize: "13px" }}>{t("fixNoteTitle")}</strong>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "14px",
                          lineHeight: 1.55,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {report.fix_note}
                      </p>
                    </section>
                  ) : null}
                </article>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
