"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CalendarClock,
  CalendarDays,
  Check,
  List,
  MapPin,
  MessageSquare,
  User,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  StatusTag,
  Tabs,
  useToast,
  type StatusTone,
} from "@upm/ui";
import { MAX_RESCHEDULES, VISIT_STATUS_LABELS, type VisitStatus } from "@upm/db/interaction";

import { formatDate, formatTime, type VisitRow } from "../interaction/interactionTypes";

/** 04 §5.6 — cada estado de visita tem o seu tom; nenhuma cor escrita à mão. */
export const VISIT_TONE: Record<VisitStatus, StatusTone> = {
  pending: "visitPending",
  accepted: "visitAccepted",
  rescheduled: "visitRescheduled",
  cancelled: "visitCancelled",
  completed: "visitCompleted",
  archived: "visitArchived",
};

export type VisitActions = {
  onAccept: (id: string) => Promise<{ error?: string }>;
  onReschedule: (input: { id: string; date: string; time: string }) => Promise<{ error?: string }>;
  onCancel: (id: string) => Promise<{ error?: string }>;
  onArchive: (id: string) => Promise<{ error?: string }>;
};

export type VisitsScreenProps = VisitActions & {
  rows: VisitRow[];
  pageTitle: string;
  pageSubtitle: string;
  /** Muda os textos e para onde aponta "Abrir conversa" — não a lógica. */
  role: "owner" | "buyer";
  /** Mês mostrado no calendário, como `YYYY-MM`. A página decide qual é. */
  month: string;
};

const FILTERS: { id: "all" | VisitStatus; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "pending", label: VISIT_STATUS_LABELS.pending },
  { id: "accepted", label: VISIT_STATUS_LABELS.accepted },
  { id: "rescheduled", label: VISIT_STATUS_LABELS.rescheduled },
  { id: "completed", label: VISIT_STATUS_LABELS.completed },
  { id: "cancelled", label: VISIT_STATUS_LABELS.cancelled },
  { id: "archived", label: VISIT_STATUS_LABELS.archived },
];

/**
 * Agenda de visitas (P5-02) — 04 §8.3 e §8.4, 07 §1.2 e §5.6.
 * =========================================================================
 * Lista e calendário, filtros por estado com a cor do estado, e as ações com
 * as regras que 07 §5.6 fixou: três reagendamentos no total, alternados. Quem
 * propôs a data que está em cima da mesa não a aceita nem propõe outra — os
 * botões desaparecem, e o servidor recusa na mesma se alguém os forçar.
 *
 * "Aceitar" abre o modal de confirmação que 07 §1.2.3 escreve palavra por
 * palavra: aceitar torna a morada exata visível para este comprador.
 */
export function VisitsScreen({
  rows,
  pageTitle,
  pageSubtitle,
  role,
  month,
  onAccept,
  onReschedule,
  onCancel,
  onArchive,
}: VisitsScreenProps) {
  const [filter, setFilter] = useState<"all" | VisitStatus>("all");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [confirming, setConfirming] = useState<VisitRow | null>(null);
  const [rescheduling, setRescheduling] = useState<VisitRow | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const visible = filter === "all" ? rows : rows.filter((row) => row.status === filter);

  const tabs = FILTERS.map((item) => ({
    id: item.id,
    label: item.label,
    count: item.id === "all" ? rows.length : rows.filter((row) => row.status === item.id).length,
    countTone: item.id === "all" ? undefined : VISIT_TONE[item.id],
  }));

  function run(action: () => Promise<{ error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      toast(result.error ?? success, result.error ? "error" : "success");
    });
  }

  function confirmAccept() {
    if (!confirming) return;
    const row = confirming;
    setConfirming(null);
    run(() => onAccept(row.id), "Visita confirmada. O comprador foi notificado.");
  }

  function confirmReschedule() {
    if (!rescheduling) return;
    const row = rescheduling;
    setRescheduling(null);
    run(
      () => onReschedule({ id: row.id, date, time }),
      "Nova data proposta. O outro lado foi notificado.",
    );
  }

  return (
    <>
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        actions={
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
            <Button
              variant={view === "list" ? "primary" : "secondary"}
              onClick={() => setView("list")}
              leadingIcon={<List size={14} aria-hidden="true" />}
            >
              Lista
            </Button>
            <Button
              variant={view === "calendar" ? "primary" : "secondary"}
              onClick={() => setView("calendar")}
              leadingIcon={<CalendarDays size={14} aria-hidden="true" />}
            >
              Calendário
            </Button>
          </div>
        }
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-7)" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "var(--sp-5)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Tabs
              label="Filtrar visitas por estado"
              items={tabs}
              value={filter}
              onValueChange={(id) => setFilter(id as "all" | VisitStatus)}
            />
          </div>
        </div>

        {view === "list" ? (
          <VisitList
            rows={visible}
            role={role}
            pending={pending}
            onAskAccept={setConfirming}
            onAskReschedule={(row) => {
              setRescheduling(row);
              setDate("");
              setTime("");
            }}
            onCancel={(row) =>
              run(() => onCancel(row.id), "Visita cancelada. O outro lado foi notificado.")
            }
            onArchive={(row) => run(() => onArchive(row.id), "Visita arquivada.")}
          />
        ) : (
          <VisitCalendar rows={visible} month={month} />
        )}

        <Modal
          open={confirming !== null}
          onClose={() => setConfirming(null)}
          title="Aceitar o pedido de visita"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirming(null)}>
                Voltar
              </Button>
              <Button onClick={confirmAccept} disabled={pending}>
                Aceitar e partilhar morada
              </Button>
            </>
          }
        >
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            Ao aceitar, a morada exata de <strong>{confirming?.propertyTitle}</strong> fica visível
            para <strong>{confirming?.other.name}</strong>. Apenas para este comprador.
          </p>
          <p style={{ margin: "var(--sp-5) 0 0", color: "var(--muted)", lineHeight: 1.6 }}>
            Pode revogar esta permissão mais tarde, no detalhe do imóvel. Se preferir não partilhar,
            cancele o pedido — não existe aceitar sem partilhar a morada.
          </p>
        </Modal>

        <Modal
          open={rescheduling !== null}
          onClose={() => setRescheduling(null)}
          title="Propor outra data"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setRescheduling(null)}>
                Voltar
              </Button>
              <Button onClick={confirmReschedule} disabled={pending || !date || !time}>
                Propor data
              </Button>
            </>
          }
        >
          <div style={{ display: "grid", gap: "var(--sp-5)" }}>
            <Input
              label="Data"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <Input
              label="Hora"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
            {rescheduling && rescheduling.rescheduleCount === MAX_RESCHEDULES - 1 ? (
              <p style={{ margin: 0, color: "var(--warn)", lineHeight: 1.6 }}>
                Este é o último reagendamento possível. Depois disto, só resta aceitar a data ou
                cancelar — e a visita pode perder-se.
              </p>
            ) : (
              <p style={{ margin: 0, color: "var(--muted)" }}>
                Reagendamentos usados: {rescheduling?.rescheduleCount ?? 0} de {MAX_RESCHEDULES}.
              </p>
            )}
          </div>
        </Modal>
      </div>
    </>
  );
}

type ListProps = {
  rows: VisitRow[];
  role: "owner" | "buyer";
  pending: boolean;
  onAskAccept: (row: VisitRow) => void;
  onAskReschedule: (row: VisitRow) => void;
  onCancel: (row: VisitRow) => void;
  onArchive: (row: VisitRow) => void;
};

function VisitList({
  rows,
  role,
  pending,
  onAskAccept,
  onAskReschedule,
  onCancel,
  onArchive,
}: ListProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Sem visitas neste filtro"
        description={
          role === "owner"
            ? "Os pedidos de visita aos seus imóveis aparecem aqui assim que chegarem."
            : "Peça uma visita a partir do detalhe de um imóvel no Market."
        }
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      {rows.map((row) => {
        const open = row.status === "pending" || row.status === "rescheduled";
        // 07 §5.6 — só o lado que não propôs a data atual pode aceitá-la.
        const canAccept = open && !row.proposedByMe;
        const canReschedule =
          (open || row.status === "accepted") &&
          row.rescheduleCount < MAX_RESCHEDULES &&
          !row.proposedByMe;
        const canCancel = open || row.status === "accepted";
        const canArchive = row.status === "completed" || row.status === "cancelled";

        return (
          <Card key={row.id} padded>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                gap: "var(--sp-7)",
              }}
            >
              <div style={{ display: "grid", gap: "var(--sp-2)", minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--sp-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ fontSize: "var(--fs-body-lg)" }}>{row.propertyTitle}</strong>
                  <StatusTag tone={VISIT_TONE[row.status]}>
                    {VISIT_STATUS_LABELS[row.status]}
                  </StatusTag>
                </div>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--sp-2)",
                    color: "var(--muted)",
                  }}
                >
                  <MapPin size={13} aria-hidden="true" />
                  {row.propertyLocation}
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--sp-2)",
                    color: "var(--muted)",
                  }}
                >
                  <User size={13} aria-hidden="true" />
                  {row.other.name}
                </span>
                {row.message ? (
                  <span style={{ color: "var(--muted)" }}>«{row.message}»</span>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: "var(--sp-4)", minWidth: 0 }}>
                <div style={{ display: "flex", gap: "var(--sp-7)", flexWrap: "wrap" }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--sp-2)",
                      fontWeight: "var(--fw-bold)",
                    }}
                  >
                    <CalendarDays size={14} aria-hidden="true" color="var(--accent)" />
                    {formatDate(row.proposedAt)}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--sp-2)",
                      fontWeight: "var(--fw-bold)",
                    }}
                  >
                    <CalendarClock size={14} aria-hidden="true" color="var(--accent)" />
                    {formatTime(row.proposedAt)}
                  </span>
                </div>
                <span style={{ color: "var(--muted)" }}>
                  Reagendamentos: {row.rescheduleCount}/{MAX_RESCHEDULES}
                  {row.proposedByMe && row.rescheduleCount < MAX_RESCHEDULES
                    ? " · a vez é do outro lado"
                    : ""}
                </span>
                <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
                  {canAccept ? (
                    <Button
                      onClick={() => onAskAccept(row)}
                      disabled={pending}
                      leadingIcon={<Check size={14} aria-hidden="true" />}
                    >
                      Aceitar
                    </Button>
                  ) : null}
                  {canReschedule ? (
                    <Button
                      variant="secondary"
                      onClick={() => onAskReschedule(row)}
                      disabled={pending}
                      leadingIcon={<CalendarClock size={14} aria-hidden="true" />}
                    >
                      Reagendar
                    </Button>
                  ) : null}
                  {canCancel ? (
                    <Button
                      variant="danger"
                      onClick={() => onCancel(row)}
                      disabled={pending}
                      leadingIcon={<X size={14} aria-hidden="true" />}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                  {canArchive ? (
                    <Button variant="secondary" onClick={() => onArchive(row)} disabled={pending}>
                      Arquivar
                    </Button>
                  ) : null}
                  <a
                    href="/mensagens"
                    className="upm-btn upm-btn--ghost upm-btn--md"
                    style={{ textDecoration: "none" }}
                  >
                    <MessageSquare size={14} aria-hidden="true" />
                    Abrir conversa
                  </a>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function VisitCalendar({ rows, month }: { rows: VisitRow[]; month: string }) {
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart);
  const monthIndex = Number(monthPart);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(year, monthIndex - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
    // Semana começa à segunda, como o protótipo.
    const offset = (first.getUTCDay() + 6) % 7;
    const total = Math.ceil((offset + daysInMonth) / 7) * 7;

    return Array.from({ length: total }, (_, index) => {
      const day = index - offset + 1;
      const inMonth = day >= 1 && day <= daysInMonth;
      const events = inMonth
        ? rows.filter((row) => {
            const date = new Date(row.proposedAt);
            return (
              date.getFullYear() === year &&
              date.getMonth() === monthIndex - 1 &&
              date.getDate() === day
            );
          })
        : [];
      return { day: inMonth ? day : null, events };
    });
  }, [rows, year, monthIndex]);

  const title = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, monthIndex - 1, 1)),
  );

  return (
    <Card>
      <div
        style={{
          padding: "var(--sp-6) var(--sp-7)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <strong style={{ fontSize: "var(--fs-subtitle-lg)", textTransform: "capitalize" }}>
          {title}
        </strong>
      </div>
      {/* Uma semana tem sempre sete dias: não há como empilhar um calendário.
          Em vez de espremer as colunas até a etiqueta da visita deixar de se
          ler, dá-se-lhes um mínimo de 92 px e é a grelha que rola de lado —
          dentro do cartão, nunca a página (02 §13). */}
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(92px, 1fr))",
            minWidth: "100%",
          }}
        >
          {WEEKDAYS.map((label) => (
            <span
              key={label}
              style={{
                padding: "var(--sp-4)",
                textAlign: "center",
                fontSize: "var(--fs-label)",
                fontWeight: "var(--fw-black)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--muted)",
                background: "var(--surface2)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {label}
            </span>
          ))}
          {cells.map((cell, index) => (
            <div
              key={index}
              style={{
                minHeight: 96,
                padding: "var(--sp-3)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--sp-2)",
                borderRight: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
                background: cell.day ? "var(--surface)" : "var(--surface2)",
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                {cell.day ?? ""}
              </span>
              {cell.events.map((event) => (
                <StatusTag key={event.id} tone={VISIT_TONE[event.status]}>
                  {formatTime(event.proposedAt)} {event.other.name.split(" ")[0]}
                </StatusTag>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
