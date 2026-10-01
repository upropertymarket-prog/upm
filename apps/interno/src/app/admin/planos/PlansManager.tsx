"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Layers, RefreshCw, Wallet } from "lucide-react";
import {
  Button,
  Card,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusTag,
  Table,
  Textarea,
  Toggle,
  type TableColumn,
} from "@upm/ui";
import { LIMIT_KEYS, LIMIT_LABELS, type LimitKey, type PlanLimits } from "@upm/db/billing";

/**
 * Admin › Planos (P7-05 · 04 §8.5)
 * =========================================================================
 * Métricas em cima, "Planos ativos" e "Saúde da receita" ao meio, faturação
 * recente em baixo — a ordem da referência.
 *
 * O modal de edição é o único sítio do produto onde se escreve um preço. Os
 * valores que lá estão hoje são os de 07 §8.3, **provisórios**: a questão
 * 07 §9 #2 continua aberta e o aviso no topo do modal diz isso em voz alta.
 */

const currency = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" });

function money(cents: number) {
  return currency.format(cents / 100);
}

export type PlanRow = {
  planId: string;
  slug: string;
  name: string;
  audience: "owner" | "buyer" | "both";
  priceMonthCents: number;
  priceYearCents: number;
  visible: boolean;
  subscribers: number;
  mrrCents: number;
  features: string[];
  limits: PlanLimits;
  syncedWithStripe: boolean;
};

export type BillingSummary = {
  mrrCents: number;
  subscribers: number;
  trials: number;
  pastDue: number;
  canceled30d: number;
  new30d: number;
  addonSubscribers: number;
};

export type AdminInvoiceRow = {
  id: string;
  number: string | null;
  totalCents: number;
  status: string;
  issuedAt: string | null;
  clientName: string;
  planName: string | null;
};

export type PlanActionState = { ok?: boolean; error?: string; notice?: string };

/** P7-06 — 07 §8.1: o pedido cai em Admin › Planos › Pedidos de trial. */
export type TrialRequestRow = {
  id: string;
  clientName: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  trialEndsAt: string | null;
  createdAt: string;
};

const AUDIENCE_LABEL: Record<PlanRow["audience"], string> = {
  owner: "Proprietário",
  buyer: "Comprador",
  both: "Ambos",
};

export function PlansManager({
  plans,
  summary,
  invoices,
  trialRequests,
  onSave,
  onSync,
  onDecideTrial,
}: {
  plans: PlanRow[];
  summary: BillingSummary;
  invoices: AdminInvoiceRow[];
  trialRequests: TrialRequestRow[];
  onSave: (prev: PlanActionState, formData: FormData) => Promise<PlanActionState>;
  onSync: () => Promise<{ notice?: string; error?: string }>;
  onDecideTrial: (requestId: string, approve: boolean) => Promise<PlanActionState>;
}) {
  const [editing, setEditing] = useState<PlanRow | "new" | null>(null);
  const [state, action, saving] = useActionState(onSave, {});
  const [syncState, setSyncState] = useState<{ notice?: string; error?: string }>({});
  const [syncing, startSync] = useTransition();
  const [deciding, startDecide] = useTransition();
  const [trialNotice, setTrialNotice] = useState<string | null>(null);

  // Fecha o modal quando a gravação passa; mantém-no aberto no erro, para a
  // pessoa não perder o que escreveu.
  useEffect(() => {
    if (state.ok) setEditing(null);
  }, [state.ok]);

  const churn =
    summary.subscribers + summary.canceled30d > 0
      ? summary.canceled30d / (summary.subscribers + summary.canceled30d)
      : 0;

  const invoiceColumns: TableColumn<AdminInvoiceRow>[] = [
    {
      id: "client",
      header: "Cliente",
      cell: (row) => (
        <span style={{ display: "grid" }}>
          <strong>{row.clientName}</strong>
          <span style={{ color: "var(--muted)" }}>{row.number ?? "—"}</span>
        </span>
      ),
    },
    { id: "plan", header: "Plano", cell: (row) => row.planName ?? "—" },
    { id: "total", header: "Valor", numeric: true, cell: (row) => money(row.totalCents) },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <StatusTag tone={row.status === "paid" ? "active" : "pending"}>
          {row.status === "paid" ? "Paga" : row.status === "open" ? "Por pagar" : row.status}
        </StatusTag>
      ),
    },
    {
      id: "issued",
      header: "Data",
      cell: (row) => (row.issuedAt ? dateFormat.format(new Date(row.issuedAt)) : "—"),
    },
  ];

  return (
    <>
      <PageHeader
        title="Planos"
        subtitle="Receita, planos e faturação da plataforma"
        actions={
          <div style={{ display: "flex", gap: "var(--sp-4)" }}>
            <Button
              variant="secondary"
              disabled={syncing}
              leadingIcon={<RefreshCw size={16} />}
              onClick={() => startSync(async () => setSyncState(await onSync()))}
            >
              Sincronizar com o Stripe
            </Button>
            <Button onClick={() => setEditing("new")}>Novo plano</Button>
          </div>
        }
      />

      {syncState.error || syncState.notice ? (
        <Card padded style={{ marginBottom: "var(--sp-7)" }}>
          <p role="status" style={{ margin: 0, fontSize: "var(--fs-body)" }}>
            {syncState.error ?? syncState.notice}
          </p>
        </Card>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: "var(--sp-6)",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          marginBottom: "var(--sp-8)",
        }}
      >
        <Metric label="MRR" value={money(summary.mrrCents)} hint="Anual mensalizado" />
        <Metric
          label="Subscritores"
          value={String(summary.subscribers)}
          hint={`${summary.trials} em experiência`}
        />
        <Metric
          label="Novos (30 dias)"
          value={String(summary.new30d)}
          hint={`${summary.canceled30d} cancelaram`}
        />
        <Metric
          label="Extras ativos"
          value={String(summary.addonSubscribers)}
          hint="Cloud 5 GB e afins"
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: "var(--sp-7)",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          alignItems: "start",
          marginBottom: "var(--sp-8)",
        }}
      >
        <Card padded>
          <h2
            style={{
              margin: "0 0 var(--sp-6)",
              fontSize: "var(--fs-subtitle)",
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-3)",
            }}
          >
            <Layers size={17} aria-hidden="true" style={{ color: "var(--accent)" }} />
            Planos ativos
          </h2>

          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid" }}>
            {plans.map((plan) => (
              <li
                key={plan.planId}
                style={{
                  display: "flex",
                  gap: "var(--sp-5)",
                  alignItems: "center",
                  flexWrap: "wrap",
                  padding: "var(--sp-5) 0",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <span style={{ display: "grid", flex: "1 1 160px", minWidth: 0 }}>
                  <strong style={{ fontSize: "var(--fs-body)" }}>{plan.name}</strong>
                  <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                    {AUDIENCE_LABEL[plan.audience]} · {money(plan.priceMonthCents)}/mês
                  </span>
                </span>
                <span style={{ display: "grid", textAlign: "right" }}>
                  <strong style={{ fontSize: "var(--fs-body)" }}>{plan.subscribers}</strong>
                  <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                    subscritores
                  </span>
                </span>
                <span style={{ display: "grid", textAlign: "right", minWidth: 88 }}>
                  <strong style={{ fontSize: "var(--fs-body)" }}>{money(plan.mrrCents)}</strong>
                  <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>MRR</span>
                </span>
                {plan.syncedWithStripe ? null : (
                  <StatusTag tone="pending">Fora do Stripe</StatusTag>
                )}
                <Button variant="secondary" size="sm" onClick={() => setEditing(plan)}>
                  Editar
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card padded>
          <h2
            style={{
              margin: "0 0 var(--sp-6)",
              fontSize: "var(--fs-subtitle)",
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-3)",
            }}
          >
            <Wallet size={17} aria-hidden="true" style={{ color: "var(--accent)" }} />
            Saúde da receita
          </h2>
          <Health
            label="Churn (30 dias)"
            value={`${(churn * 100).toFixed(1)} %`}
            ratio={churn}
            hint={`${summary.canceled30d} cancelamentos sobre ${summary.subscribers + summary.canceled30d} contas`}
          />
          <Health
            label="Pagamentos em atraso"
            value={String(summary.pastDue)}
            ratio={summary.subscribers > 0 ? summary.pastDue / summary.subscribers : 0}
            hint="Subscrições com cobrança falhada"
          />
          <Health
            label="Em período de experiência"
            value={String(summary.trials)}
            ratio={summary.subscribers > 0 ? summary.trials / summary.subscribers : 0}
            hint="Contas por converter"
          />
        </Card>
      </div>

      <h2 style={{ margin: "0 0 var(--sp-6)", fontSize: "var(--fs-subtitle-lg)" }}>
        Pedidos de trial
      </h2>
      <Card padded style={{ marginBottom: "var(--sp-8)" }}>
        {trialNotice ? (
          <p role="status" style={{ margin: "0 0 var(--sp-5)", fontSize: "var(--fs-body)" }}>
            {trialNotice}
          </p>
        ) : null}

        {trialRequests.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "var(--fs-body)" }}>
            Nenhum pedido de extensão até agora.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid" }}>
            {trialRequests.map((request) => (
              <li
                key={request.id}
                style={{
                  display: "flex",
                  gap: "var(--sp-5)",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  padding: "var(--sp-5) 0",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <span
                  style={{ display: "grid", gap: "var(--sp-2)", flex: "1 1 280px", minWidth: 0 }}
                >
                  <strong style={{ fontSize: "var(--fs-body)" }}>{request.clientName}</strong>
                  <span
                    style={{ fontSize: "var(--fs-body)", color: "var(--muted)", lineHeight: 1.5 }}
                  >
                    {request.reason}
                  </span>
                  <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                    Experiência até{" "}
                    {request.trialEndsAt ? dateFormat.format(new Date(request.trialEndsAt)) : "—"}
                  </span>
                </span>

                {request.status === "pending" ? (
                  <span style={{ display: "flex", gap: "var(--sp-4)" }}>
                    <Button
                      size="sm"
                      disabled={deciding}
                      onClick={() =>
                        startDecide(async () => {
                          const result = await onDecideTrial(request.id, true);
                          setTrialNotice(result.error ?? result.notice ?? "Aprovado.");
                        })
                      }
                    >
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={deciding}
                      onClick={() =>
                        startDecide(async () => {
                          const result = await onDecideTrial(request.id, false);
                          setTrialNotice(result.error ?? "Pedido recusado.");
                        })
                      }
                    >
                      Recusar
                    </Button>
                  </span>
                ) : (
                  <StatusTag tone={request.status === "approved" ? "active" : "rejected"}>
                    {request.status === "approved" ? "Aprovado" : "Recusado"}
                  </StatusTag>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <h2 style={{ margin: "0 0 var(--sp-6)", fontSize: "var(--fs-subtitle-lg)" }}>
        Faturação recente
      </h2>
      <Table
        caption="Faturas mais recentes da plataforma"
        columns={invoiceColumns}
        rows={invoices}
        rowKey={(row) => row.id}
        empty={<p style={{ margin: 0, color: "var(--muted)" }}>Ainda não há faturas.</p>}
      />

      {editing ? (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing === "new" ? "Novo plano" : `Editar ${editing.name}`}
        >
          <PlanForm
            plan={editing === "new" ? null : editing}
            action={action}
            saving={saving}
            state={state}
          />
        </Modal>
      ) : null}
    </>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card padded style={{ display: "grid", gap: "var(--sp-2)" }}>
      <strong style={{ fontSize: "var(--fs-title-sm)" }}>{value}</strong>
      <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>{hint}</span>
    </Card>
  );
}

function Health({
  label,
  value,
  ratio,
  hint,
}: {
  label: string;
  value: string;
  ratio: number;
  hint: string;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--sp-2)", marginBottom: "var(--sp-6)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
        <strong style={{ fontSize: "var(--fs-body)" }}>{label}</strong>
        <span style={{ marginLeft: "auto", fontSize: "var(--fs-body)", fontWeight: 700 }}>
          {value}
        </span>
      </div>
      <span
        style={{
          height: 6,
          borderRadius: "var(--r-pill)",
          background: "var(--surface3)",
          overflow: "hidden",
          display: "block",
        }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: `${Math.round(Math.min(1, ratio) * 100)}%`,
            background: ratio >= 0.2 ? "var(--state-pending)" : "var(--accent)",
            borderRadius: "var(--r-pill)",
          }}
        />
      </span>
      <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>{hint}</span>
    </div>
  );
}

function PlanForm({
  plan,
  action,
  saving,
  state,
}: {
  plan: PlanRow | null;
  action: (formData: FormData) => void;
  saving: boolean;
  state: PlanActionState;
}) {
  const [visible, setVisible] = useState(plan?.visible ?? true);

  return (
    <form action={action} style={{ display: "grid", gap: "var(--sp-6)" }}>
      {plan ? <input type="hidden" name="id" value={plan.planId} /> : null}
      <input type="hidden" name="visible" value={visible ? "on" : "off"} />

      <p
        style={{
          margin: 0,
          fontSize: "var(--fs-body)",
          color: "var(--muted)",
          lineHeight: 1.5,
        }}
      >
        Os preços da grelha atual são <strong>provisórios</strong> (07 §8.3) e esperam decisão do
        cliente. Guardar um preço diferente cria um <code>Price</code> novo no Stripe — o anterior
        nunca é alterado e continua a servir quem já o subscreveu.
      </p>

      <div
        style={{
          display: "grid",
          gap: "var(--sp-5)",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <Input label="Nome" name="name" defaultValue={plan?.name ?? ""} required maxLength={80} />
        <Input
          label="Slug"
          hint="Minúsculas, números e hífenes."
          name="slug"
          defaultValue={plan?.slug ?? ""}
          required
          maxLength={64}
        />
        <Select
          label="Público"
          name="audience"
          defaultValue={plan?.audience ?? "owner"}
          options={[
            { value: "owner", label: "Proprietário" },
            { value: "buyer", label: "Comprador" },
            { value: "both", label: "Ambos" },
          ]}
        />
        <Input
          label="Preço mensal (€)"
          name="priceMonth"
          type="number"
          step="0.01"
          min="0"
          defaultValue={((plan?.priceMonthCents ?? 0) / 100).toFixed(2)}
        />
        <Input
          label="Preço anual (€)"
          name="priceYear"
          type="number"
          step="0.01"
          min="0"
          defaultValue={((plan?.priceYearCents ?? 0) / 100).toFixed(2)}
        />
      </div>

      <fieldset
        style={{ border: "none", margin: 0, padding: 0, display: "grid", gap: "var(--sp-5)" }}
      >
        <legend style={{ fontSize: "var(--fs-body)", fontWeight: 700, padding: 0 }}>
          Limites — deixar vazio significa ilimitado
        </legend>
        <div
          style={{
            display: "grid",
            gap: "var(--sp-5)",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          {LIMIT_KEYS.map((key: LimitKey) => (
            <Input
              key={key}
              label={LIMIT_LABELS[key]}
              name={`limit_${key}`}
              type="number"
              min="0"
              step="1"
              defaultValue={
                plan?.limits[key] === null || plan?.limits[key] === undefined
                  ? ""
                  : String(plan.limits[key])
              }
            />
          ))}
        </div>
      </fieldset>

      <Textarea
        label="Funcionalidades"
        hint="Uma por linha. Aparecem no cartão do plano."
        name="features"
        rows={4}
        defaultValue={(plan?.features ?? []).join("\n")}
      />

      <Toggle checked={visible} onCheckedChange={setVisible} label="Visível na página de preços" />

      {state.error ? (
        <p role="alert" style={{ margin: 0, color: "var(--danger)", fontSize: "var(--fs-body)" }}>
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" style={{ margin: 0, color: "var(--muted)", fontSize: "var(--fs-body)" }}>
          {state.notice}
        </p>
      ) : null}

      <Button type="submit" disabled={saving}>
        {saving ? "A guardar…" : "Guardar plano"}
      </Button>
    </form>
  );
}
