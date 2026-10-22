"use client";

import { useEffect, useState, useTransition } from "react";
import { ClipboardCopy, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCanvasSafeRouter } from "../../../lib/useCanvasSafeRouter";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  StatusTag,
  Tabs,
  Textarea,
  useToast,
  type StatusTone,
} from "@upm/ui";
import {
  TICKET_STATUSES,
  ticketToMarkdown,
  type SupportTicketDetail,
  type SupportTicketRow,
  type TicketCounts,
  type TicketHistoryRow,
  type TicketSeverity,
  type TicketStatus,
  type TicketTab,
} from "@upm/db/support";

import type { TicketActionResult } from "./actions";

/**
 * Tickets do Suporte — 04 §2.6 (P10-02)
 * =========================================================================
 * Lista à esquerda, detalhe à direita, lado a lado — não é drawer. 04 §1.4
 * reserva o painel lateral para "ver/editar registo vindo de uma lista", e
 * este ecrã é diferente: o Suporte trabalha um ticket com a fila à vista, para
 * saber o que vem a seguir. Um drawer tapava a fila.
 *
 * O mesmo componente serve `/admin/tickets` com `readOnly` (07 §5.10): o Admin
 * tem visibilidade global e **nenhum** controlo de workflow. Em vez de dois
 * ecrãs que divergem, é um com os controlos ausentes — ausentes mesmo, não
 * desativados: um botão cinzento convida a perguntar porquê, e a resposta
 * seria "nunca vai funcionar para si".
 */

const TABS: TicketTab[] = ["pending", "inProgress", "awaitingConfirmation", "closed"];

const TAB_TONE: Record<TicketTab, StatusTone> = {
  pending: "ticketNew",
  inProgress: "ticketProgress",
  awaitingConfirmation: "ticketAwaiting",
  closed: "ticketClosed",
};

const STATUS_TONE: Record<TicketStatus, StatusTone> = {
  new: "ticketNew",
  triage: "ticketTriage",
  in_progress: "ticketProgress",
  awaiting_confirmation: "ticketAwaiting",
  closed: "ticketClosed",
};

const SEVERITY_TONE: Record<TicketSeverity, StatusTone> = {
  critical: "severityCritical",
  high: "severityHigh",
  medium: "severityMedium",
  low: "severityLow",
};

export type TicketsManagerProps = {
  rows: SupportTicketRow[];
  counts: TicketCounts;
  tab: TicketTab;
  search: string;
  selected: SupportTicketDetail | null;
  history: TicketHistoryRow[];
  readOnly?: boolean;
  onSave?: (input: {
    ticketId: string;
    status: TicketStatus;
    fixNote?: string;
  }) => Promise<TicketActionResult>;
};

export function TicketsManager({
  rows,
  counts,
  tab,
  search,
  selected,
  history,
  readOnly = false,
  onSave,
}: TicketsManagerProps) {
  const t = useTranslations("support.tickets");
  // Ver `useCanvasSafeRouter`: no canvas não há router, e o do Next atira.
  const router = useCanvasSafeRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState(search);
  const [status, setStatus] = useState<TicketStatus>(selected?.status ?? "new");
  const [fixNote, setFixNote] = useState(selected?.fix_note ?? "");
  const [pending, startTransition] = useTransition();

  // O formulário segue o ticket aberto. Sem isto, mudar de ticket mantinha o
  // estado e a nota do anterior no ecrã — e um clique em Guardar escrevia a
  // nota de um bug noutro.
  useEffect(() => {
    setStatus(selected?.status ?? "new");
    setFixNote(selected?.fix_note ?? "");
  }, [selected?.id, selected?.status, selected?.fix_note]);

  function go(next: { tab?: TicketTab; q?: string; id?: string | null }) {
    const params = new URLSearchParams();
    params.set("tab", next.tab ?? tab);
    const q = next.q ?? query;
    if (q) params.set("q", q);
    const id = next.id === undefined ? (selected?.id ?? null) : next.id;
    if (id) params.set("id", id);
    router?.replace(`?${params.toString()}`, { scroll: false });
  }

  async function copyForAgent() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(ticketToMarkdown(selected, history));
      toast(t("copied"), "success");
    } catch {
      toast(t("copyFailed"), "error");
    }
  }

  function save() {
    if (!selected || !onSave) return;
    startTransition(async () => {
      const result = await onSave({
        ticketId: selected.id,
        status,
        fixNote: fixNote.trim() || undefined,
      });
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(t("saved"), "success");
      router?.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: "var(--sp-6)" }}>
      <div
        style={{
          display: "flex",
          gap: "var(--sp-4)",
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <Tabs
          label={t("tabsLabel")}
          value={tab}
          onValueChange={(id) => go({ tab: id as TicketTab, id: null })}
          items={TABS.map((id) => ({
            id,
            label: t(`tabs.${id}`),
            count: counts[id],
            countTone: TAB_TONE[id],
          }))}
        />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            go({ q: query, id: null });
          }}
          style={{ display: "flex", gap: "var(--sp-2)", alignItems: "flex-end" }}
        >
          <Input
            label={t("searchLabel")}
            labelHidden
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button
            size="sm"
            variant="secondary"
            type="submit"
            iconOnly
            aria-label={t("searchLabel")}
          >
            <Search size={15} />
          </Button>
        </form>
      </div>

      <div
        style={{
          display: "grid",
          // Intrínseca, sem media query: a lista encolhe até 320 px e, abaixo
          // disso, o detalhe passa para baixo sozinho.
          gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
          gap: "var(--sp-5)",
          alignItems: "start",
        }}
      >
        <Card padded>
          {rows.length === 0 ? (
            <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid" }}>
              {rows.map((row) => {
                const active = row.id === selected?.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => go({ id: row.id })}
                      aria-current={active ? "true" : undefined}
                      className="upm-row-button"
                      style={{
                        width: "100%",
                        textAlign: "left",
                        display: "grid",
                        gap: "var(--sp-2)",
                        padding: "var(--sp-4)",
                        border: "none",
                        borderBottom: "1px solid var(--border)",
                        background: active ? "var(--surface2)" : "transparent",
                        cursor: "pointer",
                        font: "inherit",
                        color: "inherit",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          gap: "var(--sp-2)",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <StatusTag tone={SEVERITY_TONE[row.severity]}>
                          {t(`severity.${row.severity}`)}
                        </StatusTag>
                        <code style={{ fontSize: "12px", color: "var(--muted)" }}>{row.ref}</code>
                        <StatusTag tone={row.origin === "auto" ? "draft" : "archived"}>
                          {t(`origin.${row.origin}`)}
                        </StatusTag>
                        <StatusTag tone={STATUS_TONE[row.status]}>
                          {t(`status.${row.status}`)}
                        </StatusTag>
                      </span>
                      <span
                        style={{
                          fontSize: "14px",
                          color: "var(--text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={row.title}
                      >
                        {row.title}
                      </span>
                      <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>
                        {t("occurrences", { count: row.occurrences })}
                        {row.route ? ` · ${row.route}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {selected ? (
          <Card padded>
            <div style={{ display: "grid", gap: "var(--sp-5)" }}>
              <header style={{ display: "grid", gap: "var(--sp-2)" }}>
                <span
                  style={{
                    display: "flex",
                    gap: "var(--sp-2)",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <code style={{ fontSize: "12px", color: "var(--muted)" }}>{selected.ref}</code>
                  <StatusTag tone={SEVERITY_TONE[selected.severity]}>
                    {t(`severity.${selected.severity}`)}
                  </StatusTag>
                  <StatusTag tone={STATUS_TONE[selected.status]}>
                    {t(`status.${selected.status}`)}
                  </StatusTag>
                </span>
                <h2 style={{ margin: 0, fontSize: "17px", color: "var(--text)" }}>
                  {selected.title}
                </h2>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
                  {t("reportedBy", { name: selected.reporter_name })} ·{" "}
                  {t("affected", { count: selected.affected_users })}
                </p>
              </header>

              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "var(--text)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {selected.description || t("noDescription")}
              </p>

              <TechnicalFacts ticket={selected} t={t} />

              {history.length > 0 ? (
                <section style={{ display: "grid", gap: "var(--sp-2)" }}>
                  <strong style={{ fontSize: "13px" }}>{t("historyTitle")}</strong>
                  <ol
                    style={{
                      margin: 0,
                      paddingLeft: "var(--sp-5)",
                      display: "grid",
                      gap: "var(--sp-1)",
                      fontSize: "13px",
                      color: "var(--muted)",
                    }}
                  >
                    {history.map((event, index) => (
                      <li key={`${event.occurred_at}-${index}`}>
                        {t(`status.${event.status_to}`)}
                        {event.actor_name ? ` · ${event.actor_name}` : ""}
                        {event.note ? ` — ${event.note}` : ""}
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
                <Button
                  size="sm"
                  variant="secondary"
                  leadingIcon={<ClipboardCopy size={15} />}
                  onClick={copyForAgent}
                >
                  {t("copyForAgent")}
                </Button>
              </div>

              {!readOnly && onSave ? (
                <section
                  style={{
                    display: "grid",
                    gap: "var(--sp-4)",
                    borderTop: "1px solid var(--border)",
                    paddingTop: "var(--sp-5)",
                  }}
                >
                  <Select
                    label={t("statusLabel")}
                    value={status}
                    onChange={(event) => setStatus(event.target.value as TicketStatus)}
                    options={TICKET_STATUSES.map((value) => ({
                      value,
                      label: t(`status.${value}`),
                    }))}
                  />
                  <Textarea
                    label={t("fixNoteLabel")}
                    hint={t("fixNoteHint")}
                    value={fixNote}
                    rows={3}
                    maxLength={2000}
                    onChange={(event) => setFixNote(event.target.value)}
                  />
                  <div>
                    <Button onClick={save} disabled={pending}>
                      {pending ? t("saving") : t("saveAndNotify")}
                    </Button>
                  </div>
                </section>
              ) : null}
            </div>
          </Card>
        ) : (
          <Card padded>
            <EmptyState title={t("pickTitle")} description={t("pickBody")} />
          </Card>
        )}
      </div>
    </div>
  );
}

type Translate = ReturnType<typeof useTranslations<"support.tickets">>;

/** Os factos técnicos e as últimas ações, do detalhe de 04 §2.6. */
function TechnicalFacts({ ticket, t }: { ticket: SupportTicketDetail; t: Translate }) {
  const facts: [string, string | null][] = [
    ["route", ticket.route],
    ["build", ticket.build_sha],
    ["browser", ticket.browser],
    ["os", ticket.os],
    ["viewport", ticket.viewport],
    ["network", ticket.network],
  ];
  const visible = facts.filter(([, value]) => Boolean(value));
  const errors = Array.isArray(ticket.console_errors) ? ticket.console_errors : [];
  const trail = Array.isArray(ticket.breadcrumbs) ? ticket.breadcrumbs : [];

  return (
    <section
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "var(--sp-4)",
        display: "grid",
        gap: "var(--sp-3)",
      }}
    >
      <strong style={{ fontSize: "13px" }}>{t("technicalTitle")}</strong>

      {visible.length > 0 ? (
        <dl
          style={{
            margin: 0,
            display: "grid",
            gridTemplateColumns: "minmax(5rem, auto) 1fr",
            gap: "var(--sp-1) var(--sp-4)",
            fontSize: "13px",
          }}
        >
          {visible.map(([key, value]) => (
            <div key={key} style={{ display: "contents" }}>
              <dt
                style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}
              >
                {key}
              </dt>
              <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/* A diferença entre "não capturámos" e "a retenção apagou" (90 dias). */}
      {ticket.technical_purged_at ? (
        <p style={{ margin: 0, fontSize: "12.5px", color: "var(--muted)" }}>{t("purged")}</p>
      ) : null}

      {errors.length > 0 ? (
        <pre
          style={{
            margin: 0,
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            color: "var(--danger)",
          }}
        >
          {errors.map(String).join("\n")}
        </pre>
      ) : null}

      {trail.length > 0 ? (
        <details>
          <summary style={{ fontSize: "13px", cursor: "pointer" }}>
            {t("trail", { count: trail.length })}
          </summary>
          <ol
            style={{
              margin: "var(--sp-2) 0 0",
              paddingLeft: "var(--sp-5)",
              fontSize: "12.5px",
              color: "var(--muted)",
              display: "grid",
              gap: "2px",
            }}
          >
            {trail.map((step, index) => {
              const entry = step as { kind?: string; label?: string };
              return (
                <li key={index}>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{entry.kind}</span> —{" "}
                  {entry.label}
                </li>
              );
            })}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
