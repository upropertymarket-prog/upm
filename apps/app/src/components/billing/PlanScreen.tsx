"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  Check,
  CloudUpload,
  CreditCard,
  Download,
  ExternalLink,
  Minus,
  Receipt,
} from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatusTag,
  Table,
  Tabs,
  useToast,
  type StatusTone,
  type TableColumn,
} from "@upm/ui";
import {
  BILLING_INTERVAL_LABELS,
  LIMIT_KEYS,
  LIMIT_LABELS,
  isUnlimited,
  type BillingInterval,
} from "@upm/db/billing";
import { formatBytes } from "@upm/db/cloud";

import type {
  AddonOption,
  InvoiceRow,
  PlanOption,
  PlanStatus,
  TrialStatus,
} from "../../lib/billing";

/**
 * Plano e faturação — `/plano` (P7-02 · 04 §8.3)
 * =========================================================================
 * Três blocos, pela ordem da referência: o plano atual com o uso real, a
 * grelha de planos do perfil, e as faturas.
 *
 * **Não há um preço escrito neste ficheiro.** Tudo o que aparece em euros vem
 * de `plans`/`addons` — a grelha de 07 §8.3 é provisória e a questão 07 §9 #2
 * continua aberta. Um número aqui dentro tornava-a definitiva sem ninguém
 * decidir nada.
 */

const currency = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" });

function price(cents: number) {
  return currency.format(cents / 100);
}

function day(value: string | null) {
  return value ? dateFormat.format(new Date(value)) : "—";
}

const SUBSCRIPTION_TONE: Record<string, StatusTone> = {
  active: "active",
  trialing: "new",
  past_due: "pending",
  canceled: "archived",
  incomplete: "pending",
};

const SUBSCRIPTION_LABEL: Record<string, string> = {
  active: "Ativa",
  trialing: "Período de experiência",
  past_due: "Pagamento em atraso",
  canceled: "Cancelada",
  incomplete: "Por concluir",
};

const INVOICE_TONE: Record<string, StatusTone> = {
  paid: "active",
  open: "pending",
  draft: "draft",
  uncollectible: "rejected",
  void: "archived",
};

const INVOICE_LABEL: Record<string, string> = {
  paid: "Paga",
  open: "Por pagar",
  draft: "Rascunho",
  uncollectible: "Incobrável",
  void: "Anulada",
};

export type PlanScreenProps = {
  status: PlanStatus;
  plans: PlanOption[];
  addons: AddonOption[];
  invoices: InvoiceRow[];
  /** Plano pré-selecionado por quem veio do registo (`?plano=`). */
  highlightPlanSlug?: string;
  /** `?extra=cloud`, o link que o ecrã `/cloud` emite (07 §19.4). */
  highlightAddon?: boolean;
  checkoutResult?: "sucesso" | "cancelado";
  onCheckout: (input: {
    kind: "plan" | "addon";
    slug: string;
    interval: BillingInterval;
  }) => Promise<{ url?: string; error?: string }>;
  onOpenPortal: () => Promise<{ url?: string; error?: string }>;
  /** P7-04 — abre o PDF do Stripe. */
  onExportInvoice: (invoiceId: string) => Promise<{ url?: string; error?: string }>;
  /** P7-04 — copia o PDF para a Cloud do próprio. */
  onSaveInvoice: (invoiceId: string) => Promise<{ ok?: boolean; error?: string }>;
  /** P7-06 — estado do período de experiência (07 §8.1). */
  trial: TrialStatus;
  onRequestExtension: (
    prev: { ok?: boolean; error?: string },
    formData: FormData,
  ) => Promise<{ ok?: boolean; error?: string }>;
};

export function PlanScreen({
  status,
  plans,
  addons,
  invoices,
  highlightPlanSlug,
  highlightAddon = false,
  checkoutResult,
  onCheckout,
  onOpenPortal,
  onExportInvoice,
  onSaveInvoice,
  trial,
  onRequestExtension,
}: PlanScreenProps) {
  const [interval, setInterval] = useState<BillingInterval>(status.interval ?? "year");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const [extensionState, requestExtension, requestingExtension] = useActionState(
    onRequestExtension,
    {},
  );

  const cloudAddon = addons.find((addon) => addon.grants.cloud_gb);

  const usageRows = useMemo(
    () => LIMIT_KEYS.filter((key) => key !== "cloud_gb").filter((key) => key in status.limits),
    [status.limits],
  );

  function go(result: { url?: string; error?: string }) {
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    if (result.url) window.location.assign(result.url);
  }

  function checkout(kind: "plan" | "addon", slug: string) {
    startTransition(async () => go(await onCheckout({ kind, slug, interval })));
  }

  function portal() {
    startTransition(async () => go(await onOpenPortal()));
  }

  function exportInvoice(id: string) {
    startTransition(async () => {
      const result = await onExportInvoice(id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      // Separador novo: a página fica onde está e o PDF abre ao lado.
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  function saveInvoice(id: string) {
    startTransition(async () => {
      const result = await onSaveInvoice(id);
      // Sem Cloud no plano, a recusa vem do servidor com a razão (07 §19.4) —
      // e o caminho para a resolver é esta mesma página.
      toast(result.error ?? "Fatura guardada na Cloud.", result.error ? "error" : "success");
    });
  }

  const invoiceColumns: TableColumn<InvoiceRow>[] = [
    {
      id: "number",
      header: "Fatura",
      cell: (row) => (
        <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
          <Receipt size={16} aria-hidden="true" style={{ color: "var(--muted)", flex: "none" }} />
          <strong>{row.number ?? "—"}</strong>
        </span>
      ),
    },
    { id: "issued", header: "Data", cell: (row) => day(row.issuedAt) },
    { id: "total", header: "Total", numeric: true, cell: (row) => price(row.totalCents) },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <StatusTag tone={INVOICE_TONE[row.status] ?? "draft"}>
          {INVOICE_LABEL[row.status] ?? row.status}
        </StatusTag>
      ),
    },
    {
      id: "actions",
      header: "",
      width: "220px",
      cell: (row) => (
        <span style={{ display: "flex", gap: "var(--sp-3)", justifyContent: "flex-end" }}>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending || !row.hasPdf || row.savedToCloud}
            onClick={() => saveInvoice(row.id)}
            leadingIcon={<CloudUpload size={14} />}
            title={row.savedToCloud ? "Já está na sua Cloud" : "Guardar na Cloud"}
          >
            {row.savedToCloud ? "Guardada" : "Guardar"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending || !row.hasPdf}
            onClick={() => exportInvoice(row.id)}
            leadingIcon={<Download size={14} />}
          >
            Exportar
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Plano"
        subtitle="O seu plano, o que está a usar e as suas faturas"
        actions={
          status.subscriptionId ? (
            <Button
              variant="secondary"
              onClick={portal}
              disabled={pending}
              leadingIcon={<ExternalLink size={16} />}
            >
              Gerir faturação
            </Button>
          ) : undefined
        }
      />

      {checkoutResult ? (
        <Card
          padded
          style={{
            borderColor: checkoutResult === "sucesso" ? "var(--state-active)" : "var(--border)",
            marginBottom: "var(--sp-7)",
          }}
        >
          <p style={{ margin: 0, fontSize: "var(--fs-body)" }}>
            {checkoutResult === "sucesso"
              ? "Pagamento recebido. A subscrição fica ativa assim que o Stripe confirmar — normalmente em segundos."
              : "Pagamento cancelado. Nada foi cobrado."}
          </p>
        </Card>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* Plano atual + uso real                                            */}
      {/* ---------------------------------------------------------------- */}
      <Card
        padded
        style={{
          display: "grid",
          gap: "var(--sp-8)",
          gridTemplateColumns: "minmax(220px, 1fr) minmax(0, 2fr)",
          alignItems: "start",
          borderColor: "var(--accent)",
          background: "var(--accent-soft)",
          marginBottom: "var(--sp-7)",
        }}
      >
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          <span
            style={{
              fontSize: "var(--fs-pill)",
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--accent)",
            }}
          >
            Plano atual
          </span>
          <strong style={{ fontSize: "var(--fs-title-sm)" }}>{status.planName ?? "—"}</strong>
          <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
            {status.subscriptionStatus
              ? `${BILLING_INTERVAL_LABELS[status.interval ?? "year"]} · ${
                  status.cancelAtPeriodEnd ? "termina" : "renova"
                } a ${day(status.currentPeriodEnd)}`
              : "Sem subscrição paga"}
          </span>
          {status.subscriptionStatus ? (
            <StatusTag tone={SUBSCRIPTION_TONE[status.subscriptionStatus] ?? "draft"}>
              {SUBSCRIPTION_LABEL[status.subscriptionStatus] ?? status.subscriptionStatus}
            </StatusTag>
          ) : null}
        </div>

        <div
          style={{
            display: "grid",
            gap: "var(--sp-6)",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          }}
        >
          {usageRows.map((key) => (
            <UsageMeter
              key={key}
              label={LIMIT_LABELS[key]}
              used={status.usage[key]}
              limit={status.limits[key]}
            />
          ))}
          <UsageMeter
            label={LIMIT_LABELS.cloud_gb}
            used={status.cloudUsedBytes}
            limit={status.cloudLimitBytes}
            format={formatBytes}
          />
        </div>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Período de experiência — 07 §8.1                                  */}
      {/* ---------------------------------------------------------------- */}
      {trial.trialing ? (
        <Card padded style={{ display: "grid", gap: "var(--sp-5)", marginBottom: "var(--sp-7)" }}>
          <div style={{ display: "grid", gap: "var(--sp-2)" }}>
            <strong style={{ fontSize: "var(--fs-body-lg)" }}>
              Período de experiência até {day(trial.trialEndsAt)}
            </strong>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)", lineHeight: 1.5 }}>
              {trial.requestStatus === "pending"
                ? "O seu pedido de mais 7 dias está a ser analisado pela equipa."
                : trial.requestStatus === "approved"
                  ? "O pedido de extensão foi aprovado — a data acima já inclui os 7 dias extra."
                  : trial.requestStatus === "rejected"
                    ? "O pedido de extensão foi recusado; a experiência termina na data original."
                    : "Pode pedir mais 7 dias, uma única vez, com uma justificação escrita."}
            </span>
          </div>

          {trial.requestStatus ? null : (
            <form action={requestExtension} style={{ display: "grid", gap: "var(--sp-4)" }}>
              <label style={{ display: "grid", gap: "var(--sp-2)" }}>
                <span style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>
                  Porque precisa de mais tempo?
                </span>
                <textarea
                  name="reason"
                  rows={3}
                  minLength={10}
                  maxLength={1000}
                  required
                  className="upm-input"
                  style={{ resize: "vertical", padding: "var(--sp-4)", fontSize: "var(--fs-body)" }}
                />
              </label>
              {extensionState.error ? (
                <p role="alert" style={{ margin: 0, color: "var(--danger)" }}>
                  {extensionState.error}
                </p>
              ) : null}
              <Button type="submit" variant="secondary" disabled={requestingExtension}>
                {requestingExtension ? "A enviar…" : "Pedir mais 7 dias"}
              </Button>
            </form>
          )}
        </Card>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* Planos                                                            */}
      {/* ---------------------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--sp-6)",
          flexWrap: "wrap",
          marginBottom: "var(--sp-6)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "var(--fs-subtitle-lg)" }}>Planos</h2>
        <Tabs
          label="Periodicidade"
          value={interval}
          onValueChange={(id) => setInterval(id as BillingInterval)}
          items={[
            { id: "month", label: BILLING_INTERVAL_LABELS.month },
            { id: "year", label: `${BILLING_INTERVAL_LABELS.year} · 2 meses grátis` },
          ]}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: "var(--sp-7)",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          marginBottom: "var(--sp-9)",
        }}
      >
        {plans.map((plan) => {
          const current = plan.id === status.planId;
          const cents = interval === "month" ? plan.priceMonthCents : plan.priceYearCents;
          const free = plan.priceMonthCents === 0 && plan.priceYearCents === 0;

          return (
            <Card
              key={plan.id}
              padded
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--sp-5)",
                borderColor:
                  current || plan.slug === highlightPlanSlug ? "var(--accent)" : "var(--border)",
              }}
            >
              <StatusTag tone={current ? "active" : "draft"}>
                {current ? `${plan.name} · atual` : plan.name}
              </StatusTag>

              <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-2)" }}>
                <strong style={{ fontSize: "var(--fs-title-sm)" }}>{price(cents)}</strong>
                <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                  {interval === "month" ? "/mês" : "/ano"}
                </span>
              </div>

              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: "var(--sp-3)",
                }}
              >
                {LIMIT_KEYS.filter((key) => key in plan.limits).map((key) => (
                  <li
                    key={key}
                    style={{
                      display: "flex",
                      gap: "var(--sp-3)",
                      alignItems: "flex-start",
                      fontSize: "var(--fs-body)",
                      lineHeight: 1.45,
                    }}
                  >
                    <Check
                      size={15}
                      aria-hidden="true"
                      style={{ color: "var(--accent)", flex: "none", marginTop: 2 }}
                    />
                    <span>
                      {LIMIT_LABELS[key]}:{" "}
                      <strong>
                        {isUnlimited(plan.limits[key]) ? "ilimitado" : plan.limits[key]}
                      </strong>
                    </span>
                  </li>
                ))}
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    style={{
                      display: "flex",
                      gap: "var(--sp-3)",
                      alignItems: "flex-start",
                      fontSize: "var(--fs-body)",
                      lineHeight: 1.45,
                    }}
                  >
                    <Check
                      size={15}
                      aria-hidden="true"
                      style={{ color: "var(--accent)", flex: "none", marginTop: 2 }}
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: "auto" }}>
                {current ? (
                  <Button variant="secondary" fullWidth disabled>
                    Plano atual
                  </Button>
                ) : free ? (
                  <Button variant="ghost" fullWidth disabled>
                    Incluído sem custo
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    disabled={pending || !plan.purchasable}
                    onClick={() => checkout("plan", plan.slug)}
                    leadingIcon={<CreditCard size={16} />}
                  >
                    {!plan.purchasable
                      ? "Brevemente"
                      : trial.eligible
                        ? "Experimentar 7 dias grátis"
                        : "Mudar para este plano"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Extra Cloud — 07 §19.3                                            */}
      {/* ---------------------------------------------------------------- */}
      {cloudAddon && !status.hasCloudAddon ? (
        <Card
          padded
          style={{
            display: "flex",
            gap: "var(--sp-7)",
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: "var(--sp-9)",
            borderColor: highlightAddon ? "var(--accent)" : "var(--border)",
          }}
        >
          <div style={{ display: "grid", gap: "var(--sp-2)", flex: "1 1 320px", minWidth: 0 }}>
            <strong style={{ fontSize: "var(--fs-body-lg)" }}>{cloudAddon.name}</strong>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)", lineHeight: 1.5 }}>
              Soma-se ao que o seu plano já dá. Uma unidade por conta — quem precisa de mais
              capacidade sobe de plano.
            </span>
          </div>
          <strong style={{ fontSize: "var(--fs-subtitle-lg)" }}>
            {price(interval === "month" ? cloudAddon.priceMonthCents : cloudAddon.priceYearCents)}
            <span
              style={{
                fontSize: "var(--fs-body)",
                color: "var(--muted)",
                fontWeight: 600,
              }}
            >
              {interval === "month" ? "/mês" : "/ano"}
            </span>
          </strong>
          <Button
            variant="secondary"
            disabled={pending || !cloudAddon.purchasable}
            onClick={() => checkout("addon", cloudAddon.slug)}
          >
            {cloudAddon.purchasable ? "Adicionar" : "Brevemente"}
          </Button>
        </Card>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* Faturas                                                           */}
      {/* ---------------------------------------------------------------- */}
      <h2 style={{ margin: "0 0 var(--sp-6)", fontSize: "var(--fs-subtitle-lg)" }}>Faturas</h2>
      <Table
        caption="Faturas da conta"
        columns={invoiceColumns}
        rows={invoices}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={<Receipt size={22} />}
            title="Ainda não há faturas"
            description="As faturas aparecem aqui assim que houver uma subscrição paga."
          />
        }
      />
    </>
  );
}

/**
 * Um contador por limite. Ilimitado não desenha barra — uma barra sempre vazia
 * sugeria um limite que não existe.
 */
function UsageMeter({
  label,
  used,
  limit,
  format = (value: number) => String(value),
}: {
  label: string;
  used: number;
  limit: number | null | undefined;
  format?: (value: number) => string;
}) {
  const unlimited = isUnlimited(limit);
  const ratio = unlimited || limit === 0 ? 0 : Math.min(1, used / limit);

  return (
    <div style={{ display: "grid", gap: "var(--sp-2)" }}>
      <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>{label}</span>
      <strong style={{ fontSize: "var(--fs-subtitle)" }}>
        {format(used)}
        <span style={{ color: "var(--muted)", fontWeight: 600 }}>
          {unlimited ? (
            " de ilimitado"
          ) : (
            <>
              {" de "}
              {format(limit)}
            </>
          )}
        </span>
      </strong>
      {unlimited ? (
        <span
          aria-hidden="true"
          style={{ display: "flex", alignItems: "center", color: "var(--muted)" }}
        >
          <Minus size={14} />
        </span>
      ) : (
        <span
          role="img"
          aria-label={`${format(used)} de ${format(limit)}`}
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
              width: `${Math.round(ratio * 100)}%`,
              background: ratio >= 0.8 ? "var(--state-pending)" : "var(--accent)",
              borderRadius: "var(--r-pill)",
            }}
          />
        </span>
      )}
    </div>
  );
}
