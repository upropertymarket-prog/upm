"use client";

import { useState, useTransition } from "react";
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
import {
  LEAD_OUTCOME_LABELS,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type LeadOutcome,
  type LeadStage,
} from "@upm/db/interaction";

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

const STAGE_NOTE: Record<LeadStage, string> = {
  new: "à espera de resposta",
  contacted: "diálogo em curso",
  visit: "visita marcada",
  closed: "negócio concluído",
};

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
      toast("Lead atualizada.", "success");
      setOpen(null);
    });
  }

  const columns: TableColumn<LeadRow>[] = [
    {
      id: "contact",
      header: "Interessado",
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
              fontWeight: "var(--fw-black)",
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
              {row.lastMessage || "Sem mensagens"}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "property",
      header: "Propriedade",
      width: "220px",
      cell: (row) => (
        <span style={{ color: "var(--text)", fontWeight: "var(--fw-medium)" }}>
          {row.propertyTitle} · {row.propertyLocation}
        </span>
      ),
    },
    {
      id: "when",
      header: "Recebido",
      width: "167px",
      cell: (row) => (
        <span style={{ color: "var(--muted)" }}>{formatRelative(row.lastActivityAt)}</span>
      ),
    },
    {
      id: "stage",
      header: "Estado",
      width: "158px",
      cell: (row) => (
        <StatusTag tone={LEAD_TONE[row.stage]}>
          {row.stage === "closed" && row.outcome
            ? LEAD_OUTCOME_LABELS[row.outcome]
            : LEAD_STAGE_LABELS[row.stage]}
        </StatusTag>
      ),
    },
    {
      id: "actions",
      header: "Ações",
      width: "310px",
      cell: (row) => (
        <div
          style={{
            display: "flex",
            gap: "var(--sp-3)",
            justifyContent: "flex-end",
            width: "max-content",
          }}
        >
          <a
            href={row.conversationId ? `/mensagens?conversa=${row.conversationId}` : "/mensagens"}
            className="upm-btn upm-btn--secondary upm-btn--sm"
            style={{ textDecoration: "none", width: 124, minWidth: 32, padding: 0 }}
          >
            <MessageSquare size={14} aria-hidden="true" />
            Responder
          </a>
          <a
            href="/agenda"
            className="upm-btn upm-btn--secondary upm-btn--sm"
            style={{ textDecoration: "none" }}
            aria-label={`Ver agenda de ${row.contact.name}`}
          >
            <CalendarPlus size={14} aria-hidden="true" />
          </a>
          <Button variant="ghost" size="sm" onClick={() => openLead(row)}>
            Detalhes
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
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
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
                {LEAD_STAGE_LABELS[value]}
              </span>
              <span style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-3)" }}>
                <strong style={{ fontSize: "var(--fs-title-sm)" }}>{count}</strong>
                <span style={{ color: "var(--muted)" }}>{Math.round((count / total) * 100)}%</span>
              </span>
              <span style={{ color: "var(--muted)" }}>{STAGE_NOTE[value]}</span>
            </Card>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Ainda sem leads"
          description="Uma lead aparece aqui assim que alguém lhe enviar a primeira mensagem ou pedir uma visita a um dos seus imóveis."
        />
      ) : (
        <Card>
          <Table
            caption="Leads"
            columns={columns}
            rows={visible}
            rowKey={(row) => row.id}
            empty="Nenhuma lead neste estado."
          />
        </Card>
      )}

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.contact.name ?? "Lead"}
        subtitle={open ? `${open.propertyTitle} · ${open.propertyLocation}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Fechar
            </Button>
            <Button onClick={save} disabled={pending || (stage === "closed" && !outcome)}>
              Guardar
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: "var(--sp-7)" }}>
          <div style={{ display: "grid", gap: "var(--sp-2)" }}>
            <span style={{ color: "var(--muted)" }}>Última atividade</span>
            <strong>{open ? formatRelative(open.lastActivityAt) : ""}</strong>
          </div>
          {open?.lastMessage ? (
            <div style={{ display: "grid", gap: "var(--sp-2)" }}>
              <span style={{ color: "var(--muted)" }}>Última mensagem</span>
              <p style={{ margin: 0, lineHeight: 1.6 }}>«{open.lastMessage}»</p>
            </div>
          ) : null}

          <Select
            label="Estado no funil"
            value={stage}
            onChange={(event) => {
              const next = event.target.value as LeadStage;
              setStage(next);
              if (next !== "closed") setOutcome("");
            }}
            options={LEAD_STAGES.map((value) => ({
              value,
              label: LEAD_STAGE_LABELS[value],
            }))}
          />

          {stage === "closed" ? (
            <Select
              label="O negócio concretizou-se?"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as LeadOutcome)}
              placeholder="Escolha o desfecho"
              options={[
                { value: "won", label: LEAD_OUTCOME_LABELS.won },
                { value: "lost", label: LEAD_OUTCOME_LABELS.lost },
              ]}
              hint="Só uma lead concretizada sugere marcar o imóvel como vendido ou arrendado."
            />
          ) : null}
        </div>
      </Drawer>
    </div>
  );
}
