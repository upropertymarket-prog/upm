"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarPlus, MessageSquare } from "lucide-react";
import {
  Button,
  Card,
  STATUS_TONES,
  StatusTag,
  Table,
  type StatusTone,
  type TableColumn,
} from "@upm/ui";
import { DEMO_OWNER_LEADS, type DemoLead } from "@upm/ui/demo-data";

import { useDemoFormat } from "./format";

/**
 * Leads da demonstração — 04 §8.3 · 07 §18.2
 * =========================================================================
 * Os quatro cartões do funil com percentagem e borda esquerda colorida, e a
 * tabela por baixo — o desenho de `LeadsScreen`. Clicar num cartão filtra a
 * tabela, como no produto; o que não existe aqui é o drawer de detalhe, porque
 * mudar o estágio de uma lead inventada não tem para onde escrever.
 *
 * Os tons saem de `STATUS_TONES`, nunca de um hex: a borda do cartão "Novo" é
 * a mesma cor da etiqueta "Novo" na tabela, e é isso que 04 §5.6 pede.
 */

const STAGES: DemoLead["stage"][] = ["new", "contacted", "visit", "closed"];

const STAGE_TONE: Record<DemoLead["stage"], StatusTone> = {
  new: "new",
  contacted: "pending",
  visit: "visitAccepted",
  closed: "active",
};

export function DemoLeads() {
  const t = useTranslations("leads");
  const tThread = useTranslations("site.demo.thread");
  const format = useDemoFormat();
  const [filter, setFilter] = useState<DemoLead["stage"] | null>(null);

  const visible = filter
    ? DEMO_OWNER_LEADS.filter((lead) => lead.stage === filter)
    : DEMO_OWNER_LEADS;
  const total = DEMO_OWNER_LEADS.length;

  const columns: TableColumn<DemoLead>[] = [
    {
      id: "contact",
      header: t("columnContact"),
      cell: (lead) => (
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
              fontWeight: "var(--fw-medium)",
              flex: "none",
            }}
          >
            {lead.initials}
          </span>
          <div style={{ display: "grid", minWidth: 0 }}>
            <strong>{lead.name}</strong>
            <span
              style={{
                color: "var(--muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {tThread(lead.messageKey)}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "property",
      header: t("columnProperty"),
      width: "220px",
      cell: (lead) => (
        <span style={{ color: "var(--text)", fontWeight: "var(--fw-medium)" }}>
          {lead.property} · {lead.city}
        </span>
      ),
    },
    {
      id: "when",
      header: t("columnWhen"),
      width: "140px",
      cell: (lead) => <span style={{ color: "var(--muted)" }}>{format.ago(lead.minutesAgo)}</span>,
    },
    {
      id: "stage",
      header: t("columnStage"),
      width: "150px",
      cell: (lead) => (
        <StatusTag tone={STAGE_TONE[lead.stage]}>
          {lead.stage === "closed" && lead.outcome
            ? t(`outcome.${lead.outcome}`)
            : t(`stage.${lead.stage}`)}
        </StatusTag>
      ),
    },
    {
      id: "actions",
      header: t("columnActions"),
      width: "230px",
      cell: (lead) => (
        <div
          style={{
            display: "flex",
            gap: "var(--sp-3)",
            alignItems: "center",
            justifyContent: "flex-end",
            width: "max-content",
          }}
        >
          <Button variant="secondary" size="md" leadingIcon={<MessageSquare size={16} />}>
            {t("reply")}
          </Button>
          <Button variant="secondary" iconOnly aria-label={t("openSchedule", { name: lead.name })}>
            <CalendarPlus size={16} />
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
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
          gap: "var(--sp-6)",
        }}
      >
        {STAGES.map((stage) => {
          const count = DEMO_OWNER_LEADS.filter((lead) => lead.stage === stage).length;
          const selected = filter === stage;
          return (
            <Card
              key={stage}
              padded
              interactive
              aria-pressed={selected}
              onClick={() => setFilter(selected ? null : stage)}
              style={{
                borderLeft: `2px solid ${STATUS_TONES[STAGE_TONE[stage]]}`,
                display: "grid",
                gap: "var(--sp-3)",
              }}
            >
              <span style={{ color: "var(--muted)", fontWeight: "var(--fw-semibold)" }}>
                {t(`stage.${stage}`)}
              </span>
              <span style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-3)" }}>
                <strong style={{ fontSize: "var(--fs-title-sm)" }}>{count}</strong>
                <span style={{ color: "var(--muted)" }}>{Math.round((count / total) * 100)}%</span>
              </span>
              <span style={{ color: "var(--muted)" }}>{t(`stageNote.${stage}`)}</span>
            </Card>
          );
        })}
      </div>

      <Card>
        <Table
          caption={t("tableCaption")}
          columns={columns}
          rows={visible}
          rowKey={(lead) => lead.id}
          empty={t("tableEmpty")}
        />
      </Card>
    </div>
  );
}
