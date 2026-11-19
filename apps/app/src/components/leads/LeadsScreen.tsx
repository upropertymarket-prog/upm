"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, resolveLocale } from "@upm/config";
import { CalendarPlus, MessageSquare } from "lucide-react";
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  STATUS_TONES,
  Select,
  StatusTag,
  Table,
  useToast,
  type StatusTone,
  type TableColumn,
} from "@upm/ui";
import { LEAD_STAGES, type LeadOutcome, type LeadStage } from "@upm/db/interaction";

import { formatRelative, type LeadRow } from "../interaction/interactionTypes";

/**
 * 04 §5.6 — um tom por significado. O funil usa os tons de ciclo de vida que já
 * existem; não se inventa uma cor nova para uma lead.
 */
export const LEAD_TONE: Record<LeadStage, StatusTone> = {
  new: "new",
  contacted: "pending",
  visit: "visitAccepted",
  closed: "active",
};

/** A nota de cada cartão está em `leads.stageNote.*`. */

export type LeadsScreenProps = {
  rows: LeadRow[];
  onUpdateStage: (input: {
    id: string;
    stage: LeadStage;
    outcome: LeadOutcome | null;
  }) => Promise<{ error?: string }>;
};

/**
 * Leads do proprietário (P5-03) — 04 §8.3, 07 §18.2/§18.3.
 * =========================================================================
 * Quatro cartões de pipeline com percentagem e borda esquerda colorida (como a
 * referência), tabela por baixo e drawer de detalhe à direita — o padrão de
 * 04 §5.4 para "ver um registo vindo de uma lista".
 *
 * As leads não se criam aqui: nascem da primeira mensagem ou do primeiro
 * pedido de visita (07 §18.3). A única escrita deste ecrã é mudar o estágio —
 * e fechar obriga a dizer se o negócio se concretizou.
 */
export function LeadsScreen({ rows, onUpdateStage }: LeadsScreenProps) {
  const t = useTranslations("leads");
  const intlLocale = INTL_LOCALE[resolveLocale(useLocale())];
  const tCommon = useTranslations("common");
  const [stageFilter, setStageFilter] = useState<LeadStage | null>(null);
  const [open, setOpen] = useState<LeadRow | null>(null);
  const [stage, setStage] = useState<LeadStage>("new");
  const [outcome, setOutcome] = useState<LeadOutcome | "">("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const total = rows.length || 1;
  const visible = stageFilter ? rows.filter((row) => row.stage === stageFilter) : rows;

  function openLead(row: LeadRow) {
    setOpen(row);
    setStage(row.stage);
    setOutcome(row.outcome ?? "");
  }

  function save() {
    if (!open) return;
    const id = open.id;
    startTransition(async () => {
      const result = await onUpdateStage({
        id,
        stage,
        outcome: stage === "closed" ? outcome || null : null,
      });
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(t("updated"), "success");
      setOpen(null);
    });
  }

  const columns: TableColumn<LeadRow>[] = [
    {
      id: "contact",
      header: t("columnContact"),
      width: "316px",
      cell: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 34,
              height: 34,
              borderRadius: "var(--r-pill)",
              background: "var(--surface3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              // Medium, igual ao `.upm-avatar` da barra lateral: este círculo é
              // uma cópia à mão dele e tem de pesar o mesmo.
              fontWeight: "var(--fw-medium)",
              flex: "none",
            }}
          >
            {row.contact.initials}
          </span>
          <div style={{ display: "grid", minWidth: 0 }}>
            <strong>{row.contact.name}</strong>
            <span
              style={{
                color: "var(--muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.lastMessage || t("noMessages")}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "property",
      header: t("columnProperty"),
      width: "220px",
      cell: (row) => (
        <span style={{ color: "var(--text)", fontWeight: "var(--fw-medium)" }}>
          {row.propertyTitle} · {row.propertyLocation}
        </span>
      ),
    },
    {
      id: "when",
      header: t("columnWhen"),
      width: "167px",
      cell: (row) => (
        <span style={{ color: "var(--muted)" }}>
          {formatRelative(row.lastActivityAt, intlLocale)}
        </span>
      ),
    },
    {
      id: "stage",
      header: t("columnStage"),
      width: "158px",
      cell: (row) => (
        <StatusTag tone={LEAD_TONE[row.stage]}>
          {row.stage === "closed" && row.outcome
            ? t(`outcome.${row.outcome}`)
            : t(`stage.${row.stage}`)}
        </StatusTag>
      ),
    },
    {
      id: "actions",
      header: t("columnActions"),
      width: "310px",
      cell: (row) => (
        <div
          style={{
            display: "flex",
            gap: "var(--sp-3)",
            /* O atalho da agenda é 40 px (`--tap`, 04 §1.8) e os dois com
               rótulo 36 px: sem `center` alinhavam pelo topo da célula. */
            alignItems: "center",
            justifyContent: "flex-end",
            width: "max-content",
          }}
        >
          <Link
            href={
              row.conversationId
                ? `/mensagens?conversa=${row.conversationId}`
                : ("/mensagens" as Route)
            }
            className="upm-btn upm-btn--secondary upm-btn--md"
            style={{ textDecoration: "none", width: 124, minWidth: 32, padding: 0 }}
          >
            <MessageSquare size={16} aria-hidden="true" />
            {t("reply")}
          </Link>
          <Link
            href="/agenda"
            className="upm-btn upm-btn--secondary upm-btn--icon"
            style={{ textDecoration: "none" }}
            aria-label={t("openSchedule", { name: row.contact.name })}
          >
            <CalendarPlus size={16} aria-hidden="true" />
          </Link>
          <Button variant="secondary" size="md" onClick={() => openLead(row)}>
            {t("details")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-7)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
          gap: "var(--sp-6)",
        }}
      >
        {LEAD_STAGES.map((value) => {
          const count = rows.filter((row) => row.stage === value).length;
          const selected = stageFilter === value;
          return (
            <Card
              key={value}
              padded
              interactive
              onClick={() => setStageFilter(selected ? null : value)}
              aria-pressed={selected}
              style={{
                // Borda esquerda fina com a cor do estágio (04 §8.3). O valor
                // vem do mapa de tons do design system, nunca de um hex.
                borderLeft: `2px solid ${STATUS_TONES[LEAD_TONE[value]]}`,
                display: "grid",
                gap: "var(--sp-3)",
              }}
            >
              <span style={{ color: "var(--muted)", fontWeight: "var(--fw-semibold)" }}>
                {t(`stage.${value}`)}
              </span>
              <span style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-3)" }}>
                <strong style={{ fontSize: "var(--fs-title-sm)" }}>{count}</strong>
                <span style={{ color: "var(--muted)" }}>{Math.round((count / total) * 100)}%</span>
              </span>
              <span style={{ color: "var(--muted)" }}>{t(`stageNote.${value}`)}</span>
            </Card>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <Card>
          <Table
            caption={t("tableCaption")}
            columns={columns}
            rows={visible}
            rowKey={(row) => row.id}
            empty={t("tableEmpty")}
          />
        </Card>
      )}

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.contact.name ?? t("drawerFallback")}
        subtitle={open ? `${open.propertyTitle} · ${open.propertyLocation}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>
              {tCommon("close")}
            </Button>
            <Button onClick={save} disabled={pending || (stage === "closed" && !outcome)}>
              {tCommon("save")}
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: "var(--sp-7)" }}>
          <div style={{ display: "grid", gap: "var(--sp-2)" }}>
            <span style={{ color: "var(--muted)" }}>{t("lastActivity")}</span>
            <strong>{open ? formatRelative(open.lastActivityAt, intlLocale) : ""}</strong>
          </div>
          {open?.lastMessage ? (
            <div style={{ display: "grid", gap: "var(--sp-2)" }}>
              <span style={{ color: "var(--muted)" }}>{t("lastMessage")}</span>
              <p style={{ margin: 0, lineHeight: 1.6 }}>«{open.lastMessage}»</p>
            </div>
          ) : null}

          <Select
            label={t("stageLabel")}
            value={stage}
            onChange={(event) => {
              const next = event.target.value as LeadStage;
              setStage(next);
              if (next !== "closed") setOutcome("");
            }}
            options={LEAD_STAGES.map((value) => ({ value, label: t(`stage.${value}`) }))}
          />

          {stage === "closed" ? (
            <Select
              label={t("outcomeQuestion")}
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as LeadOutcome)}
              placeholder={t("outcomePlaceholder")}
              options={[
                { value: "won", label: t("outcome.won") },
                { value: "lost", label: t("outcome.lost") },
              ]}
              hint={t("outcomeHint")}
            />
          ) : null}
        </div>
      </Drawer>
    </div>
  );
}
