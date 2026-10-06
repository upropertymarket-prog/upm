"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CircleCheck,
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
import { LIMIT_KEYS, isUnlimited, type BillingInterval } from "@upm/db/billing";
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
 *
 * **Nem há texto escrito aqui** (07 §5.13 · fecha metade de D39): tudo passa
 * por `plan.*` em `packages/config/messages`. As etiquetas dos estados e dos
 * limites também: `LIMIT_LABELS` e `BILLING_INTERVAL_LABELS` de `@upm/db` são
 * PT, e servem o lado do servidor e os e-mails — num ecrã, quem manda é o
 * idioma da sessão. O que **não** se traduz é o que vem da base de dados:
 * nomes de planos e `plans.features` são dados, e traduzi-los é uma coluna
 * nova, não uma chave de tradução.
 */

const SUBSCRIPTION_TONE: Record<string, StatusTone> = {
  active: "active",
  trialing: "new",
  past_due: "pending",
  canceled: "archived",
  incomplete: "pending",
};

const PLAN_TONE: Record<string, StatusTone> = {
  gratuito: "draft",
  "essential-owner": "primary",
  "smarter-owner": "dealSale",
  "premium-owner": "dealRent",
};

const PLAN_COLOR: Record<string, string> = {
  gratuito: "var(--state-draft)",
  "essential-owner": "var(--accent)",
  "smarter-owner": "var(--state-deal-sale)",
  "premium-owner": "var(--state-deal-rent)",
};

/**
 * `plans.features` é **dado**, não texto de interface: vem do seed em PT e é
 * isso que a base de dados tem. O que esta função faz é corrigir duas linhas
 * que o seed escreve como "GB de Cloud" e que no cartão significam outra coisa
 * — e essas duas, sendo texto nosso, passam pelas traduções. O resto é a
 * normalização de "imóvel" para "propriedade" do vocabulário de 04 §5.
 */
function planFeatureLabel(feature: string, t: (key: string) => string) {
  if (feature === "2 GB de Cloud" || feature === "5 GB de Cloud") {
    return t("featureAdvancedAlerts");
  }
  if (feature === "20 GB de Cloud") {
    return t("featureCustomAlerts");
  }
  return feature
    .replace(/\bImóveis\b/g, "Propriedades")
    .replace(/\bimóveis\b/g, "propriedades")
    .replace(/\bImóvel\b/g, "Propriedade")
    .replace(/\bimóvel\b/g, "propriedade");
}

const INVOICE_TONE: Record<string, StatusTone> = {
  paid: "active",
  open: "pending",
  draft: "draft",
  uncollectible: "rejected",
  void: "archived",
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
  const t = useTranslations("plan");
  const tc = useTranslations("common");
  const locale = useLocale();
  // Moeda e data seguem o idioma da sessão: o euro é o mesmo, a forma de o
  // escrever não (1.234,56 € vs €1,234.56).
  const { price, day } = useMemo(() => {
    const currency = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
    const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
    return {
      price: (cents: number) => currency.format(cents / 100),
      day: (value: string | null) => (value ? dateFormat.format(new Date(value)) : "—"),
    };
  }, [locale]);
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
      toast(result.error ?? t("invoiceSaved"), result.error ? "error" : "success");
    });
  }

  const invoiceColumns: TableColumn<InvoiceRow>[] = [
    {
      id: "number",
      header: t("invoiceNumber"),
      cell: (row) => (
        <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
          <Receipt size={16} aria-hidden="true" style={{ color: "var(--muted)", flex: "none" }} />
          <strong>{row.number ?? "—"}</strong>
        </span>
      ),
    },
    { id: "issued", header: t("invoiceDate"), cell: (row) => day(row.issuedAt) },
    { id: "total", header: t("invoiceTotal"), numeric: true, cell: (row) => price(row.totalCents) },
    {
      id: "status",
      header: t("invoiceStatusHeader"),
      cell: (row) => (
        <StatusTag tone={INVOICE_TONE[row.status] ?? "draft"}>
          {/* Um estado que o Stripe acrescente no futuro mostra-se como vem,
              em vez de rebentar à procura de uma chave que não existe. */}
          {row.status in INVOICE_TONE ? t(`invoiceStatus.${row.status}`) : row.status}
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
            title={row.savedToCloud ? t("alreadyInCloud") : t("saveToCloud")}
          >
            {row.savedToCloud ? t("savedShort") : t("saveShort")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending || !row.hasPdf}
            onClick={() => exportInvoice(row.id)}
            leadingIcon={<Download size={14} />}
          >
            {tc("export")}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          status.subscriptionId ? (
            <Button
              variant="secondary"
              onClick={portal}
              disabled={pending}
              leadingIcon={<ExternalLink size={16} />}
            >
              {t("managePortal")}
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
            {checkoutResult === "sucesso" ? t("checkoutSuccess") : t("checkoutCanceled")}
          </p>
        </Card>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* Plano atual + uso real                                            */}
      {/* ---------------------------------------------------------------- */}
      <Card
        padded
        className="upm-split"
        style={
          {
            "--split-cols": "minmax(240px, 0.8fr) minmax(0, 2.2fr)",
            borderColor: "var(--border)",
            borderTopColor: "var(--accent)",
            borderTopWidth: 3,
            background: "var(--surface)",
            marginBottom: "var(--sp-7)",
          } as React.CSSProperties
        }
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
            {t("currentPlanLabel")}
          </span>
          <strong style={{ fontSize: "var(--fs-title-sm)" }}>{status.planName ?? "—"}</strong>
          <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
            {status.subscriptionStatus
              ? t(status.cancelAtPeriodEnd ? "endsOn" : "renewsOn", {
                  interval: t(`interval.${status.interval ?? "year"}`),
                  date: day(status.currentPeriodEnd),
                })
              : t("noPaidSubscription")}
          </span>
          {status.subscriptionStatus ? (
            <StatusTag tone={SUBSCRIPTION_TONE[status.subscriptionStatus] ?? "draft"}>
              {status.subscriptionStatus in SUBSCRIPTION_TONE
                ? t(`subscriptionStatus.${status.subscriptionStatus}`)
                : status.subscriptionStatus}
            </StatusTag>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: "var(--sp-5)", minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "var(--sp-4)",
              flexWrap: "wrap",
            }}
          >
            <strong style={{ fontSize: "var(--fs-body-lg)" }}>{t("usageTitle")}</strong>
            <span style={{ fontSize: "var(--fs-caption)", color: "var(--muted)" }}>
              {t("usageHint")}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gap: "var(--sp-4)",
              /* Seis medidores. Em três colunas fixas ficavam com 60 px cada no
                 telemóvel e a barra deixava de se ler. Os 240 px mantêm as três
                 colunas do desenho em ecrã largo (3 + 3) e descem sozinhos a
                 duas e a uma à medida que o espaço aperta. */
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
            }}
          >
            {usageRows.map((key) => (
              <UsageMeter
                key={key}
                label={t(`limits.${key}`)}
                used={status.usage[key]}
                limit={status.limits[key]}
              />
            ))}
            <UsageMeter
              label={t("limits.cloud_gb")}
              used={status.cloudUsedBytes}
              limit={status.cloudLimitBytes}
              format={formatBytes}
            />
          </div>
        </div>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Período de experiência — 07 §8.1                                  */}
      {/* ---------------------------------------------------------------- */}
      {trial.trialing ? (
        <Card padded style={{ display: "grid", gap: "var(--sp-5)", marginBottom: "var(--sp-7)" }}>
          <div style={{ display: "grid", gap: "var(--sp-2)" }}>
            <strong style={{ fontSize: "var(--fs-body-lg)" }}>
              {t("trialUntil", { date: day(trial.trialEndsAt) })}
            </strong>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)", lineHeight: 1.5 }}>
              {trial.requestStatus === "pending"
                ? t("trialPending")
                : trial.requestStatus === "approved"
                  ? t("trialApproved")
                  : trial.requestStatus === "rejected"
                    ? t("trialRejected")
                    : t("trialCanAsk")}
            </span>
          </div>

          {trial.requestStatus ? null : (
            <form action={requestExtension} style={{ display: "grid", gap: "var(--sp-4)" }}>
              <label style={{ display: "grid", gap: "var(--sp-2)" }}>
                <span style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>
                  {t("trialReasonLabel")}
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
                {requestingExtension ? t("trialSubmitting") : t("trialSubmit")}
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
        <h2 style={{ margin: 0, fontSize: "var(--fs-subtitle-lg)" }}>{t("plansTitle")}</h2>
        <Tabs
          label={t("intervalLabel")}
          value={interval}
          onValueChange={(id) => setInterval(id as BillingInterval)}
          items={[
            { id: "month", label: t("interval.month") },
            { id: "year", label: t("intervalYearBonus", { label: t("interval.year") }) },
          ]}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: "var(--sp-7)",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
          marginBottom: "var(--sp-9)",
        }}
      >
        {plans.map((plan) => {
          const current = plan.id === status.planId;
          const cents = interval === "month" ? plan.priceMonthCents : plan.priceYearCents;
          const free = plan.priceMonthCents === 0 && plan.priceYearCents === 0;
          const features = plan.features.some((feature) => /suporte/i.test(feature))
            ? plan.features
            : [...plan.features, t("supportStandard")];

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
              <StatusTag className="upm-plan-tag" tone={PLAN_TONE[plan.slug] ?? "draft"}>
                {plan.name}
              </StatusTag>

              <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-2)" }}>
                <strong style={{ fontSize: "var(--fs-title-sm)" }}>{price(cents)}</strong>
                <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                  {interval === "month" ? t("perMonth") : t("perYear")}
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
                    <CircleCheck
                      size={15}
                      aria-hidden="true"
                      style={{ color: "var(--muted)", flex: "none", marginTop: 2 }}
                    />
                    <span>
                      {key === "cloud_gb" ? t("cloudSpace") : t(`limits.${key}`)}:{" "}
                      <strong>
                        {isUnlimited(plan.limits[key]) ? t("unlimited") : plan.limits[key]}
                        {key === "cloud_gb" && !isUnlimited(plan.limits[key]) ? "GB" : ""}
                      </strong>
                    </span>
                  </li>
                ))}
                {features
                  .filter(
                    (feature) => !/\b(imóveis|imóvel|propriedades|propriedade)\b/i.test(feature),
                  )
                  .map((feature) => (
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
                      <CircleCheck
                        size={15}
                        aria-hidden="true"
                        style={{ color: "var(--muted)", flex: "none", marginTop: 2 }}
                      />
                      <span>{planFeatureLabel(feature, t)}</span>
                    </li>
                  ))}
              </ul>

              <div style={{ marginTop: "auto" }}>
                {current ? (
                  <Button variant="secondary" fullWidth disabled>
                    {t("currentPlanButton")}
                  </Button>
                ) : free ? (
                  <Button variant="ghost" fullWidth disabled>
                    {t("includedFree")}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    fullWidth
                    style={{
                      borderColor: PLAN_COLOR[plan.slug] ?? "var(--border2)",
                      color: PLAN_COLOR[plan.slug] ?? "var(--muted)",
                    }}
                    disabled={pending || !plan.purchasable}
                    onClick={() => checkout("plan", plan.slug)}
                    leadingIcon={<CreditCard size={16} />}
                  >
                    {!plan.purchasable
                      ? t("comingSoon")
                      : trial.eligible
                        ? t("tryFree")
                        : t("switchPlan")}
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
            /* Texto · preço · botão. Em três colunas de grelha o preço e o
               botão não encolhiam e empurravam o cartão para fora do ecrã;
               em flex com `wrap` descem para a linha de baixo. O `flex` do
               primeiro filho já contava com isto. */
            display: "flex",
            flexWrap: "wrap",
            columnGap: "var(--sp-7)",
            rowGap: "var(--sp-4)",
            alignItems: "center",
            marginBottom: "var(--sp-9)",
            borderColor: highlightAddon ? "var(--accent)" : "var(--border)",
          }}
        >
          <div style={{ display: "grid", gap: "var(--sp-2)", flex: "1 1 320px", minWidth: 0 }}>
            <strong style={{ fontSize: "var(--fs-body-lg)" }}>{cloudAddon.name}</strong>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)", lineHeight: 1.5 }}>
              {t("addonHint")}
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
              {interval === "month" ? t("perMonth") : t("perYear")}
            </span>
          </strong>
          <Button
            variant="secondary"
            disabled={pending || !cloudAddon.purchasable}
            onClick={() => checkout("addon", cloudAddon.slug)}
          >
            {cloudAddon.purchasable ? t("addonAdd") : t("comingSoon")}
          </Button>
        </Card>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* Faturas                                                           */}
      {/* ---------------------------------------------------------------- */}
      <h2 style={{ margin: "0 0 var(--sp-6)", fontSize: "var(--fs-subtitle-lg)" }}>
        {t("invoicesTitle")}
      </h2>
      <Table
        caption={t("invoicesCaption")}
        columns={invoiceColumns}
        rows={invoices}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={<Receipt size={22} />}
            title={t("invoicesEmptyTitle")}
            description={t("invoicesEmptyBody")}
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
  const t = useTranslations("plan");
  const unlimited = isUnlimited(limit);
  const ratio = unlimited || limit === 0 ? 0 : Math.min(1, used / limit);

  return (
    <div
      style={{
        display: "grid",
        gap: "var(--sp-2)",
        minWidth: 0,
        padding: "var(--sp-4)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        background: "var(--surface)",
      }}
    >
      <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>{label}</span>
      <strong style={{ fontSize: "var(--fs-subtitle)" }}>
        {format(used)}
        <span style={{ color: "var(--muted)", fontWeight: 600 }}>
          {unlimited ? (
            t("meterOfUnlimited")
          ) : (
            <>
              {t("meterOf")}
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
          aria-label={`${format(used)}${t("meterOf")}${format(limit)}`}
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
