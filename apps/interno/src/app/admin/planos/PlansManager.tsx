"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { LIMIT_KEYS, type LimitKey, type PlanLimits } from "@upm/db/billing";

import { useStepUp } from "../../../components/StepUpModal";
import type { VerifyPinAction } from "../../../components/stepUpTypes";

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

const PLAN_TONE: Record<string, "draft" | "primary" | "dealSale" | "dealRent"> = {
  gratuito: "draft",
  "essential-owner": "primary",
  "smarter-owner": "dealSale",
  "premium-owner": "dealRent",
};

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

/** Espelho de `PlanActionState` de `./actions` — manter os dois a par. */
export type PlanActionState = {
  ok?: boolean;
  error?: string;
  notice?: string;
  /** P8-07: o servidor recusou por falta de PIN confirmado (07 §6). */
  needsStepUp?: boolean;
  /** D40: o limite novo fica abaixo do uso de alguns subscritores. */
  overageWarning?: string;
};

/** P7-06 — 07 §8.1: o pedido cai em Admin › Planos › Pedidos de trial. */
export type TrialRequestRow = {
  id: string;
  clientName: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  trialEndsAt: string | null;
  createdAt: string;
};

/** Chave de tradução por público — o texto vive em `admin.plans`. */
const AUDIENCE_KEY: Record<PlanRow["audience"], string> = {
  owner: "audienceOwner",
  buyer: "audienceBuyer",
  both: "audienceBoth",
};

export function PlansManager({
  plans,
  summary,
  invoices,
  trialRequests,
  onSave,
  onSync,
  onDecideTrial,
  onVerifyPin,
}: {
  plans: PlanRow[];
  summary: BillingSummary;
  invoices: AdminInvoiceRow[];
  trialRequests: TrialRequestRow[];
  onSave: (prev: PlanActionState, formData: FormData) => Promise<PlanActionState>;
  onSync: () => Promise<{ notice?: string; error?: string }>;
  onDecideTrial: (requestId: string, approve: boolean) => Promise<PlanActionState>;
  /** `verifyOperationPin` — por prop, para o canvas poder passar um substituto. */
  onVerifyPin: VerifyPinAction;
}) {
  const t = useTranslations("admin.plans");
  const locale = useLocale();
  // Moeda e data no idioma da sessão (07 §5.13 · fecha D39): o valor é o
  // mesmo, a forma de o escrever não.
  const { money, shortDate } = useMemo(() => {
    const currency = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
    const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "short" });
    return {
      money: (cents: number) => currency.format(cents / 100),
      shortDate: (value: string | null) => (value ? dateFormat.format(new Date(value)) : "—"),
    };
  }, [locale]);
  const [editing, setEditing] = useState<PlanRow | "new" | null>(null);

  // O formulário submetido fica guardado para a repetição depois do step-up
  // (P8-07): confirmar o PIN não pode custar à pessoa reescrever o plano.
  const lastSubmission = useRef<FormData | null>(null);
  const [state, action, saving] = useActionState(
    async (prev: PlanActionState, formData: FormData) => {
      lastSubmission.current = formData;
      return onSave(prev, formData);
    },
    {},
  );

  const [syncState, setSyncState] = useState<{ notice?: string; error?: string }>({});
  const [syncing, startSync] = useTransition();
  const [deciding, startDecide] = useTransition();
  const [retrying, startRetry] = useTransition();
  const [trialNotice, setTrialNotice] = useState<string | null>(null);
  const { requestStepUp, stepUpModal } = useStepUp(onVerifyPin);

  // Fecha o modal quando a gravação passa; mantém-no aberto no erro, para a
  // pessoa não perder o que escreveu.
  useEffect(() => {
    if (state.ok) setEditing(null);
  }, [state.ok]);

  // 07 §6 — o servidor recusou por falta de PIN confirmado. A dependência é o
  // `state` inteiro e não `state.needsStepUp`: cada submissão devolve um objeto
  // novo, e sem isso uma segunda tentativa depois de cancelar não reabria o
  // modal.
  useEffect(() => {
    if (!state.needsStepUp) return;
    const formData = lastSubmission.current;
    if (!formData) return;
    requestStepUp(() => startRetry(() => action(formData)));
  }, [state, requestStepUp, action, startRetry]);

  const churn =
    summary.subscribers + summary.canceled30d > 0
      ? summary.canceled30d / (summary.subscribers + summary.canceled30d)
      : 0;

  const invoiceColumns: TableColumn<AdminInvoiceRow>[] = [
    {
      id: "client",
      header: t("client"),
      cell: (row) => (
        <span style={{ display: "grid" }}>
          <strong>{row.clientName}</strong>
          <span style={{ color: "var(--muted)" }}>{row.number ?? "—"}</span>
        </span>
      ),
    },
    { id: "plan", header: t("plan"), cell: (row) => row.planName ?? "—" },
    { id: "total", header: t("amount"), numeric: true, cell: (row) => money(row.totalCents) },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <StatusTag tone={row.status === "paid" ? "active" : "pending"}>
          {row.status === "paid"
            ? t("invoicePaid")
            : row.status === "open"
              ? t("invoiceOpen")
              : row.status}
        </StatusTag>
      ),
    },
    {
      id: "issued",
      header: t("date"),
      cell: (row) => shortDate(row.issuedAt),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div style={{ display: "flex", gap: "var(--sp-4)", flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              disabled={syncing}
              leadingIcon={<RefreshCw size={16} />}
              onClick={() => startSync(async () => setSyncState(await onSync()))}
            >
              {t("syncStripe")}
            </Button>
            <Button onClick={() => setEditing("new")}>{t("newPlan")}</Button>
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
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
          marginBottom: "var(--sp-8)",
        }}
      >
        <Metric label={t("mrr")} value={money(summary.mrrCents)} hint={t("mrrHint")} />
        <Metric
          label={t("subscribers")}
          value={String(summary.subscribers)}
          hint={t("subscribersHint", { count: summary.trials })}
        />
        <Metric
          label={t("new30d")}
          value={String(summary.new30d)}
          hint={t("new30dHint", { count: summary.canceled30d })}
        />
        <Metric
          label={t("addons")}
          value={String(summary.addonSubscribers)}
          hint={t("addonsHint")}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: "var(--sp-7)",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
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
            {t("activePlans")}
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
                <span
                  style={{ display: "grid", rowGap: "var(--sp-1)", flex: "1 1 160px", minWidth: 0 }}
                >
                  <StatusTag tone={PLAN_TONE[plan.slug] ?? "draft"}>{plan.name}</StatusTag>
                  <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                    {t(AUDIENCE_KEY[plan.audience])} · {money(plan.priceMonthCents)}
                    {t("perMonth")}
                  </span>
                </span>
                <span style={{ display: "grid", textAlign: "right" }}>
                  <strong style={{ fontSize: "var(--fs-body)" }}>{plan.subscribers}</strong>
                  <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                    {t("subscribersLabel")}
                  </span>
                </span>
                <span style={{ display: "grid", textAlign: "right", minWidth: 88 }}>
                  <strong style={{ fontSize: "var(--fs-body)" }}>{money(plan.mrrCents)}</strong>
                  <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>MRR</span>
                </span>
                {plan.syncedWithStripe ? null : (
                  <StatusTag tone="pending">{t("outOfStripe")}</StatusTag>
                )}
                <Button variant="secondary" size="sm" onClick={() => setEditing(plan)}>
                  {t("edit")}
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
            {t("revenueHealth")}
          </h2>
          <Health
            label={t("churn")}
            value={`${(churn * 100).toFixed(1)} %`}
            ratio={churn}
            hint={t("churnHint", {
              canceled: summary.canceled30d,
              total: summary.subscribers + summary.canceled30d,
            })}
          />
          <Health
            label={t("pastDue")}
            value={String(summary.pastDue)}
            ratio={summary.subscribers > 0 ? summary.pastDue / summary.subscribers : 0}
            hint={t("pastDueHint")}
          />
          <Health
            label={t("trialing")}
            value={String(summary.trials)}
            ratio={summary.subscribers > 0 ? summary.trials / summary.subscribers : 0}
            hint={t("trialingHint")}
          />
        </Card>
      </div>

      <h2 style={{ margin: "0 0 var(--sp-6)", fontSize: "var(--fs-subtitle-lg)" }}>
        {t("trialRequests")}
      </h2>
      <Card padded style={{ marginBottom: "var(--sp-8)" }}>
        {trialNotice ? (
          <p role="status" style={{ margin: "0 0 var(--sp-5)", fontSize: "var(--fs-body)" }}>
            {trialNotice}
          </p>
        ) : null}

        {trialRequests.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "var(--fs-body)" }}>
            {t("noTrialRequests")}
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
                    {t("trialUntil", { date: shortDate(request.trialEndsAt) })}
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
                          setTrialNotice(result.error ?? result.notice ?? t("approvedNotice"));
                        })
                      }
                    >
                      {t("approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={deciding}
                      onClick={() =>
                        startDecide(async () => {
                          const result = await onDecideTrial(request.id, false);
                          setTrialNotice(result.error ?? t("rejectedNotice"));
                        })
                      }
                    >
                      {t("reject")}
                    </Button>
                  </span>
                ) : (
                  <StatusTag tone={request.status === "approved" ? "active" : "rejected"}>
                    {request.status === "approved" ? t("approved") : t("rejected")}
                  </StatusTag>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <h2 style={{ margin: "0 0 var(--sp-6)", fontSize: "var(--fs-subtitle-lg)" }}>
        {t("recentBilling")}
      </h2>
      <Table
        caption={t("invoicesCaption")}
        columns={invoiceColumns}
        rows={invoices}
        rowKey={(row) => row.id}
        empty={<p style={{ margin: 0, color: "var(--muted)" }}>{t("noInvoices")}</p>}
      />

      {editing ? (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing === "new" ? t("newPlan") : t("editPlan", { name: editing.name })}
        >
          <PlanForm
            plan={editing === "new" ? null : editing}
            action={action}
            saving={saving || retrying}
            state={state}
          />
        </Modal>
      ) : null}

      {stepUpModal}
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
  const t = useTranslations("admin.plans");
  const [visible, setVisible] = useState(plan?.visible ?? true);

  // D40 — a confirmação dos excedentes dura uma submissão: mexer num campo
  // depois do aviso volta a pedi-la, porque os números do aviso deixam de
  // corresponder ao que está no formulário.
  //
  // O campo é escrito por `ref` e não por estado: o `onClick` do botão corre
  // imediatamente antes de o React serializar o `FormData`, e um `setState`
  // nesse instante só se veria no render seguinte — ou seja, nunca a tempo
  // desta submissão. O estado serve apenas para trocar o texto do botão.
  const confirmField = useRef<HTMLInputElement>(null);
  const [confirmOverage, setConfirmOverage] = useState(false);
  const warning = state.overageWarning;

  function resetConfirmation() {
    if (confirmField.current) confirmField.current.value = "off";
    setConfirmOverage(false);
  }

  function confirmOverageNow() {
    if (confirmField.current) confirmField.current.value = "on";
    setConfirmOverage(true);
  }

  return (
    <form
      action={action}
      onChange={resetConfirmation}
      style={{ display: "grid", gap: "var(--sp-6)" }}
    >
      {plan ? <input type="hidden" name="id" value={plan.planId} /> : null}
      <input type="hidden" name="visible" value={visible ? "on" : "off"} />
      <input ref={confirmField} type="hidden" name="confirmOverage" defaultValue="off" />

      <p
        style={{
          margin: 0,
          fontSize: "var(--fs-body)",
          color: "var(--muted)",
          lineHeight: 1.5,
        }}
      >
        {t("provisionalWarning")}
      </p>

      <div
        style={{
          display: "grid",
          gap: "var(--sp-5)",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
        }}
      >
        <Input
          label={t("name")}
          name="name"
          defaultValue={plan?.name ?? ""}
          required
          maxLength={80}
        />
        <Input
          label={t("slug")}
          hint={t("slugHint")}
          name="slug"
          defaultValue={plan?.slug ?? ""}
          required
          maxLength={64}
        />
        <Select
          label={t("audience")}
          name="audience"
          defaultValue={plan?.audience ?? "owner"}
          options={[
            { value: "owner", label: t("audienceOwner") },
            { value: "buyer", label: t("audienceBuyer") },
            { value: "both", label: t("audienceBoth") },
          ]}
        />
        <Input
          label={t("priceMonth")}
          name="priceMonth"
          type="number"
          step="0.01"
          min="0"
          defaultValue={((plan?.priceMonthCents ?? 0) / 100).toFixed(2)}
        />
        <Input
          label={t("priceYear")}
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
          {t("limitsLegend")}
        </legend>
        <div
          style={{
            display: "grid",
            gap: "var(--sp-5)",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
          }}
        >
          {LIMIT_KEYS.map((key: LimitKey) => (
            <Input
              key={key}
              label={t(`limits.${key}`)}
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
        label={t("features")}
        hint={t("featuresHint")}
        name="features"
        rows={4}
        defaultValue={(plan?.features ?? []).join("\n")}
      />

      <Toggle checked={visible} onCheckedChange={setVisible} label={t("visible")} />

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
      {/* D40 — o aviso dos excedentes. Nada foi gravado quando isto aparece. */}
      {warning ? (
        <p
          role="alert"
          style={{ margin: 0, color: "var(--warn)", fontSize: "var(--fs-body)", lineHeight: 1.5 }}
        >
          {warning}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={saving}
        /* Um aviso por confirmar muda o botão, em vez de acrescentar um
           segundo: guardar continua a ser um só gesto, com o texto a dizer o
           que esse gesto passou a significar. */
        variant={warning && !confirmOverage ? "secondary" : "primary"}
        onClick={warning && !confirmOverage ? confirmOverageNow : undefined}
      >
        {saving ? t("saving") : warning && !confirmOverage ? t("saveAnyway") : t("savePlan")}
      </Button>
    </form>
  );
}
