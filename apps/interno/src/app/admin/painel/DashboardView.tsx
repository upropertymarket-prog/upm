"use client";

import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  ClipboardList,
  Mail,
  UsersRound,
} from "lucide-react";
import { Card, EmptyState, StatusTag, Table, type TableColumn } from "@upm/ui";
import type { AdminDashboardPayload } from "../../../lib/admin-shell";

type Activity = AdminDashboardPayload["activity"][number];

/** O resumo das caixas, contado no servidor. `null` quando a leitura falhou. */
export type MailConfigSummary = { total: number; pending: number; failing: number } | null;

function LineChart({
  data,
  locale,
  t,
}: {
  data: AdminDashboardPayload["daily"];
  locale: string;
  t: (key: string) => string;
}) {
  const max = Math.max(
    1,
    ...data.flatMap((point) => [point.registrations, point.properties_submitted]),
  );
  const pathFor = (key: "registrations" | "properties_submitted") => {
    const points = data.map((point, index) => ({
      x: data.length < 2 ? 50 : 4 + (index / (data.length - 1)) * 92,
      y: 92 - (point[key] / max) * 82,
    }));
    const firstPoint = points[0];
    if (!firstPoint) return "";
    if (points.length === 1) return `M${firstPoint.x},${firstPoint.y}`;

    const slopes = points.slice(1).map((point, index) => {
      const previous = points[index];
      return previous ? point.y - previous.y : 0;
    });
    const tangents = points.map((_, index) => {
      if (index === 0) return slopes[0] ?? 0;
      if (index === points.length - 1) return slopes[slopes.length - 1] ?? 0;

      const incoming = slopes[index - 1];
      const outgoing = slopes[index];
      if (incoming === undefined || outgoing === undefined) return 0;
      if (incoming * outgoing <= 0) return 0;
      return (2 * incoming * outgoing) / (incoming + outgoing);
    });

    return points
      .map((point, index) => {
        if (index === 0) return `M${point.x},${point.y}`;

        const previous = points[index - 1];
        if (!previous) return "";
        const step = point.x - previous.x;
        const firstControlX = previous.x + step / 3;
        const secondControlX = point.x - step / 3;
        const firstControlY = previous.y + (tangents[index - 1] ?? 0) / 3;
        const secondControlY = point.y - (tangents[index] ?? 0) / 3;
        return `C${firstControlX},${firstControlY} ${secondControlX},${secondControlY} ${point.x},${point.y}`;
      })
      .join(" ");
  };
  const columns: TableColumn<AdminDashboardPayload["daily"][number]>[] = [
    {
      id: "date",
      header: t("date"),
      cell: (row) =>
        new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "pt-PT", {
          dateStyle: "medium",
        }).format(new Date(row.date + "T12:00:00Z")),
    },
    {
      id: "registrations",
      header: t("registrations"),
      numeric: true,
      cell: (row) => row.registrations,
    },
    {
      id: "properties",
      header: t("propertiesSubmitted"),
      numeric: true,
      cell: (row) => row.properties_submitted,
    },
  ];
  return (
    <div className="grid gap-4">
      <div role="img" aria-label={t("chartLabel")} className="rounded-xl bg-surface2 p-3">
        <svg
          viewBox="0 0 100 100"
          className="h-52 w-full overflow-visible"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M4,92 H96 M4,51 H96 M4,10 H96"
            fill="none"
            stroke="var(--border)"
            strokeWidth="0.5"
          />
          <path
            d={pathFor("registrations")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={pathFor("properties_submitted")}
            fill="none"
            stroke="var(--ok)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="mt-2 flex flex-wrap gap-5 text-sm">
          <span className="flex items-center gap-2">
            <i className="h-2 w-2 rounded-full bg-accent" />
            {t("registrations")}
          </span>
          <span className="flex items-center gap-2">
            <i className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--ok)" }} />
            {t("propertiesSubmitted")}
          </span>
        </div>
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-medium text-accent">
          {t("chartData")}
        </summary>
        <div className="mt-3 overflow-x-auto">
          <Table
            caption={t("chartData")}
            columns={columns}
            rows={data}
            rowKey={(row) => row.date}
          />
        </div>
      </details>
    </div>
  );
}

export function DashboardView({
  data,
  mrrCents,
  locale,
  loadError,
  mailConfig,
}: {
  data: AdminDashboardPayload | null;
  mrrCents: number;
  locale: string;
  loadError: boolean;
  mailConfig: MailConfigSummary;
}) {
  const t = useTranslations("admin.dashboard");
  const money = new Intl.NumberFormat(locale === "en" ? "en-IE" : "pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const summary = data?.summary;
  const activityColumns: TableColumn<Activity>[] = [
    {
      id: "action",
      header: t("activity"),
      cell: (row) => (
        <span className="grid">
          <strong>{t("actions." + row.action)}</strong>
          <span className="text-[length:var(--fs-body)] text-muted">
            {t("entities." + row.entity)}
          </span>
        </span>
      ),
    },
    {
      id: "date",
      header: t("date"),
      cell: (row) =>
        new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "pt-PT", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(row.created_at)),
    },
  ];
  const quickLinks = [
    ["users", "/admin/utilizadores", <UsersRound size={18} key="icon" />],
    ["moderation", "/admin/imoveis", <Building2 size={18} key="icon" />],
    ["leads", "/admin/leads-site", <ClipboardList size={18} key="icon" />],
    ["plans", "/admin/planos", <CircleDollarSign size={18} key="icon" />],
  ] as const;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </header>
      {loadError || !summary ? (
        <EmptyState title={t("loadFailed")} description={t("loadFailedHint")} />
      ) : (
        <>
          <section
            aria-label={t("keyMetrics")}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <Metric
              icon={<UsersRound size={18} />}
              label={t("users")}
              value={summary.users_total.toLocaleString(locale === "en" ? "en-IE" : "pt-PT")}
              hint={t("newUsers30d", { count: summary.users_new_30d })}
            />
            <Metric
              icon={<Building2 size={18} />}
              label={t("activeProperties")}
              value={summary.active_properties.toLocaleString()}
              hint={t("featuredProperties", { count: summary.featured_properties })}
            />
            <Metric
              icon={<CircleDollarSign size={18} />}
              label={t("mrr")}
              value={money.format(mrrCents / 100)}
              hint={t("monthlyRecurringRevenue")}
            />
            {/* 04 §2.5 dá ao Painel quatro KPIs, e o quarto é "bugs abertos".
                Esteve ocupado por "Precisa de atenção" desde a Fase 8 porque
                `tickets` não existia (D48, 07 §21.2). Os dois números que esse
                KPI somava não se perderam: continuam no cartão "Trabalho
                pendente", aqui ao lado, e nos contadores da sidebar. */}
            <Metric
              icon={<ClipboardList size={18} />}
              label={t("openBugs")}
              value={summary.open_bugs.toLocaleString()}
              hint={t("openBugsHint")}
            />
          </section>
          {/* Cartões e não botões, e sem caixa à volta (14 nov 2026, pedido do
              cliente): cada atalho é um cartão do design system, ao lado dos
              KPIs, com o que se faz lá numa linha. A Configuração de e-mail
              saiu — mexe-se nela uma vez, não é um atalho de todos os dias. */}
          <section aria-labelledby="quick-access" className="grid gap-4">
            <h2 id="quick-access" className="text-lg font-semibold text-text">
              {t("quickAccess")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {quickLinks.map(([key, href, icon]) => (
                <Link
                  key={key}
                  href={href as Route}
                  className="upm-card upm-card--pad upm-card--interactive"
                  style={{ gap: "var(--sp-5)", textDecoration: "none" }}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span
                      className="grid place-items-center rounded-xl bg-accent-soft text-accent"
                      style={{ width: 40, height: 40 }}
                    >
                      {icon}
                    </span>
                    <ArrowUpRight className="text-muted" size={16} aria-hidden="true" />
                  </span>
                  <span className="grid gap-1">
                    <span className="text-base font-semibold text-text">{t("links." + key)}</span>
                    <span className="text-sm text-muted">{t("linkHints." + key)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <Card padded>
              <section className="grid gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-text">{t("activityTrend")}</h2>
                  <p className="mt-1 text-sm text-muted">{t("last30Days")}</p>
                </div>
                <LineChart data={data?.daily ?? []} locale={locale} t={t} />
              </section>
            </Card>
            <Card padded>
              <section className="grid gap-4">
                <h2 className="text-lg font-semibold text-text">{t("pendingWork")}</h2>
                <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                  <span>{t("moderationQueue")}</span>
                  <StatusTag tone={summary.pending_moderation ? "pending" : "active"}>
                    {summary.pending_moderation}
                  </StatusTag>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                  <span>{t("newSiteLeads")}</span>
                  <StatusTag tone={summary.new_leads ? "primary" : "active"}>
                    {summary.new_leads}
                  </StatusTag>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{t("openBugs")}</span>
                  <StatusTag tone={summary.open_bugs ? "ticketNew" : "active"}>
                    {summary.open_bugs}
                  </StatusTag>
                </div>
              </section>
            </Card>
          </div>
          <MailConfigCard summary={mailConfig} t={t} />
          <Card padded>
            <section className="grid gap-4">
              <div>
                <h2 className="text-lg font-semibold text-text">{t("recentActivity")}</h2>
                <p className="mt-1 text-sm text-muted">{t("activityPrivacy")}</p>
              </div>
              {data?.activity.length ? (
                <Table
                  caption={t("recentActivity")}
                  columns={activityColumns}
                  rows={data.activity}
                  rowKey={(row) => row.created_at + row.action}
                />
              ) : (
                <EmptyState title={t("noActivity")} description={t("noActivityHint")} />
              )}
            </section>
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * Config. E-mail — o painel de configuração das caixas (P10-03)
 * =========================================================================
 * **Existe porque a configuração é a última coisa a acontecer.** As caixas são
 * criadas na Amen e só depois configuradas aqui, e isso é trabalho que fica
 * pendente durante semanas. Um item de menu não chega: ninguém abre
 * `/admin/caixas-email` para descobrir que há coisas por fazer — abre porque já
 * sabe. Este cartão é o que faz saber.
 *
 * Por isso o que mostra não são caixas, são **pendências**: quantas estão sem
 * credencial e quantas estão a falhar. Com tudo em ordem o cartão não
 * desaparece — diz que está tudo configurado, que é a informação que alguém
 * procura antes de uma entrega.
 *
 * O caso que se vê hoje é `total: 0`: nenhuma caixa criada ainda. O texto desse
 * estado diz o passo seguinte em vez de um zero seco, porque um zero aqui não
 * se distingue de um erro de leitura.
 */
function MailConfigCard({
  summary,
  t,
}: {
  summary: MailConfigSummary;
  t: ReturnType<typeof useTranslations>;
}) {
  const pending = summary?.pending ?? 0;
  const failing = summary?.failing ?? 0;
  const tone = failing > 0 ? "rejected" : pending > 0 ? "pending" : "active";

  const state = !summary
    ? t("mailConfig.loadFailed")
    : summary.total === 0
      ? t("mailConfig.none")
      : failing > 0
        ? t("mailConfig.failing", { count: failing })
        : pending > 0
          ? t("mailConfig.pending", { count: pending })
          : t("mailConfig.ready", { count: summary.total });

  return (
    <Card padded>
      <section className="flex flex-wrap items-center gap-4">
        <span className="text-accent">
          <Mail size={18} aria-hidden="true" />
        </span>
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold text-text">{t("mailConfig.title")}</h2>
          <p className="text-sm text-muted">{state}</p>
        </div>
        {summary && summary.total > 0 ? (
          <StatusTag tone={tone}>{failing > 0 ? failing : pending > 0 ? pending : "OK"}</StatusTag>
        ) : null}
        <Link
          href="/admin/caixas-email"
          className="ml-auto flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text hover:bg-surface2"
        >
          {t("mailConfig.cta")}
          <ArrowUpRight className="text-muted" size={16} aria-hidden="true" />
        </Link>
      </section>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card padded style={{ display: "grid", gap: "var(--sp-2)" }}>
      <div className="flex items-center gap-3 text-muted">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <strong className="text-3xl font-semibold tabular-nums text-text">{value}</strong>
      <p className="text-sm text-muted">{hint}</p>
    </Card>
  );
}
