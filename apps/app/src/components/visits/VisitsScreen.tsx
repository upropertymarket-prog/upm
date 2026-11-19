"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { MAX_RESCHEDULES, VISIT_STATUSES, type VisitStatus } from "@upm/db/interaction";
import { INTL_LOCALE, resolveLocale } from "@upm/config";

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
  /**
   * Visita a destacar, vinda do `?visita=` dos links das notificações
   * (D31 · `20260929120100_notifications.sql`). Um id que não esteja nas linhas
   * carregadas é ignorado: a lista abre normal, em vez de prometer um destaque
   * que não existe.
   */
  highlightId?: string | null;
};

/**
 * Só os ids, pela ordem em que os filtros se leem. A etiqueta de cada um vem
 * de `visits.status.*` — ver a nota que ficou em `@upm/db/interaction`.
 */
const FILTERS: ("all" | VisitStatus)[] = [
  "all",
  ...VISIT_STATUSES.filter((status) => status !== "pending"),
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
  highlightId = null,
  onAccept,
  onReschedule,
  onCancel,
  onArchive,
}: VisitsScreenProps) {
  const t = useTranslations("visits");
  const highlighted =
    highlightId && rows.some((row) => row.id === highlightId) ? highlightId : null;
  const [filter, setFilter] = useState<"all" | VisitStatus>("all");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [confirming, setConfirming] = useState<VisitRow | null>(null);
  const [rescheduling, setRescheduling] = useState<VisitRow | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const visible = filter === "all" ? rows : rows.filter((row) => row.status === filter);

  const tabs = FILTERS.map((id) => ({
    id,
    label: id === "all" ? t("filterAll") : t(`status.${id}`),
    count: id === "all" ? rows.length : rows.filter((row) => row.status === id).length,
    countTone: id === "all" ? undefined : VISIT_TONE[id],
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
    run(() => onAccept(row.id), t("acceptedToast"));
  }

  function confirmReschedule() {
    if (!rescheduling) return;
    const row = rescheduling;
    setRescheduling(null);
    run(() => onReschedule({ id: row.id, date, time }), t("rescheduledToast"));
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
              {t("viewList")}
            </Button>
            <Button
              variant={view === "calendar" ? "primary" : "secondary"}
              onClick={() => setView("calendar")}
              leadingIcon={<CalendarDays size={14} aria-hidden="true" />}
            >
              {t("viewCalendar")}
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
              label={t("filterLabel")}
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
            highlightId={highlighted}
            onAskAccept={setConfirming}
            onAskReschedule={(row) => {
              setRescheduling(row);
              setDate("");
              setTime("");
            }}
            onCancel={(row) => run(() => onCancel(row.id), t("cancelledToast"))}
            onArchive={(row) => run(() => onArchive(row.id), t("archivedToast"))}
          />
        ) : (
          <VisitCalendar rows={visible} month={month} />
        )}

        <Modal
          open={confirming !== null}
          onClose={() => setConfirming(null)}
          title={t("acceptRequest")}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirming(null)}>
                {t("back")}
              </Button>
              <Button onClick={confirmAccept} disabled={pending}>
                {t("acceptAndShare")}
              </Button>
            </>
          }
        >
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            {t.rich("acceptBody", {
              b: (chunks) => <strong>{chunks}</strong>,
              property: confirming?.propertyTitle ?? "",
              person: confirming?.other.name ?? "",
            })}
          </p>
          <p style={{ margin: "var(--sp-5) 0 0", color: "var(--muted)", lineHeight: 1.6 }}>
            {t("acceptNote")}
          </p>
        </Modal>

        <Modal
          open={rescheduling !== null}
          onClose={() => setRescheduling(null)}
          title={t("proposeOtherDate")}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setRescheduling(null)}>
                {t("back")}
              </Button>
              <Button onClick={confirmReschedule} disabled={pending || !date || !time}>
                {t("proposeDate")}
              </Button>
            </>
          }
        >
          <div style={{ display: "grid", gap: "var(--sp-5)" }}>
            <Input
              label={t("dateLabel")}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <Input
              label={t("timeLabel")}
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
            {rescheduling && rescheduling.rescheduleCount === MAX_RESCHEDULES - 1 ? (
              <p style={{ margin: 0, color: "var(--warn)", lineHeight: 1.6 }}>
                {t("lastRescheduleWarning")}
              </p>
            ) : (
              <p style={{ margin: 0, color: "var(--muted)" }}>
                {t("reschedulesUsed", {
                  used: String(rescheduling?.rescheduleCount ?? 0),
                  max: String(MAX_RESCHEDULES),
                })}
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
  highlightId: string | null;
  onAskAccept: (row: VisitRow) => void;
  onAskReschedule: (row: VisitRow) => void;
  onCancel: (row: VisitRow) => void;
  onArchive: (row: VisitRow) => void;
};

function VisitList({
  rows,
  role,
  pending,
  highlightId,
  onAskAccept,
  onAskReschedule,
  onCancel,
  onArchive,
}: ListProps) {
  const t = useTranslations("visits");
  const tCommon = useTranslations("common");
  const intlLocale = INTL_LOCALE[resolveLocale(useLocale())];
  // Chegar à lista pela notificação e ter de procurar a visita com os olhos é
  // o mesmo que não ter link. O destaque leva o ecrã até ela (D31).
  useEffect(() => {
    if (!highlightId) return;
    const node = document.getElementById(`visita-${highlightId}`);
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId]);

  if (rows.length === 0) {
    return (
      <EmptyState
        title={t("emptyFilter")}
        description={role === "owner" ? t("emptyOwner") : t("emptyBuyer")}
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

        const isHighlighted = row.id === highlightId;

        return (
          <Card
            key={row.id}
            padded
            id={`visita-${row.id}`}
            /* O destaque é a borda de foco do sistema, não uma cor nova: é a
               mesma pista visual que o teclado já usa para dizer "é aqui". */
            style={
              isHighlighted
                ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" }
                : undefined
            }
            aria-current={isHighlighted ? "true" : undefined}
          >
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
                  <StatusTag tone={VISIT_TONE[row.status]}>{t(`status.${row.status}`)}</StatusTag>
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
                    {formatDate(row.proposedAt, intlLocale)}
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
                    {formatTime(row.proposedAt, intlLocale)}
                  </span>
                </div>
                <span style={{ color: "var(--muted)" }}>
                  {t.rich("reschedulesLine", {
                    used: String(row.rescheduleCount),
                    max: String(MAX_RESCHEDULES),
                    count: (chunks) => (
                      <span style={{ fontWeight: "var(--fw-semibold)" }}>{chunks}</span>
                    ),
                  })}
                  {row.proposedByMe && row.rescheduleCount < MAX_RESCHEDULES ? t("theirTurn") : ""}
                </span>
                <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
                  {canAccept ? (
                    <Button
                      onClick={() => onAskAccept(row)}
                      disabled={pending}
                      leadingIcon={<Check size={14} aria-hidden="true" />}
                    >
                      {t("accept")}
                    </Button>
                  ) : null}
                  {canReschedule ? (
                    <Button
                      variant="secondary"
                      onClick={() => onAskReschedule(row)}
                      disabled={pending}
                      leadingIcon={<CalendarClock size={14} aria-hidden="true" />}
                    >
                      {t("reschedule")}
                    </Button>
                  ) : null}
                  {canCancel ? (
                    <Button
                      variant="danger"
                      onClick={() => onCancel(row)}
                      disabled={pending}
                      leadingIcon={<X size={14} aria-hidden="true" />}
                    >
                      {tCommon("cancel")}
                    </Button>
                  ) : null}
                  {canArchive ? (
                    <Button variant="secondary" onClick={() => onArchive(row)} disabled={pending}>
                      {t("archive")}
                    </Button>
                  ) : null}
                  <Link
                    href="/mensagens"
                    className="upm-btn upm-btn--secondary upm-btn--md"
                    style={{ textDecoration: "none" }}
                  >
                    <MessageSquare size={14} aria-hidden="true" />
                    {t("openConversation")}
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Os dias da semana saem do `Intl` e não de uma lista escrita à mão: eram
 * "seg…dom" fixos, que num ecrã inglês ficavam em português. A semana começa à
 * segunda, como no protótipo — daí o 1 de janeiro de 2024 como ponto de
 * partida, que foi uma segunda-feira.
 */
function weekdayLabels(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(Date.UTC(2024, 0, 1 + index))),
  );
}

function VisitCalendar({ rows, month }: { rows: VisitRow[]; month: string }) {
  const intlLocale = INTL_LOCALE[resolveLocale(useLocale())];
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

  const title = new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(
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
          {weekdayLabels(intlLocale).map((label) => (
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
                  {formatTime(event.proposedAt, intlLocale)} {event.other.name.split(" ")[0]}
                </StatusTag>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
