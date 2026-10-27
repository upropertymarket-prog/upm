"use client";

import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { Button, Card, StatusTag, Table, type TableColumn } from "@upm/ui";
import {
  DEMO_BUYER_USAGE,
  DEMO_BUYER_USER,
  DEMO_INVOICES,
  DEMO_OWNER_USAGE,
  DEMO_OWNER_USER,
  type DemoInvoice,
  type DemoUsage,
} from "@upm/ui/demo-data";

import { useDemoFormat, type DemoRole } from "./format";

/**
 * Plano da demonstração — 04 §8.3 · 07 §19.2
 * =========================================================================
 * Os três blocos de `PlanScreen` que importam a quem está a decidir se entra:
 * o plano atual com a data de renovação, **o que está a ser usado** contra os
 * limites incluídos, e as faturas. A grelha de planos fica de fora — está na
 * secção de preços da própria home, a dois ecrãs de distância, e repeti-la
 * aqui era dizer duas vezes a mesma coisa com números que teriam de ser
 * mantidos iguais em dois sítios.
 *
 * Os limites são os de 07 §19.2; os preços da demonstração são ilustrativos,
 * como o resto. O medidor fica laranja aos 90% — é o aviso do produto.
 */

function Meter({ usage }: { usage: DemoUsage }) {
  const t = useTranslations("plan");
  const ratio = usage.limit === null ? 0 : Math.min(1, usage.used / usage.limit);

  return (
    <div style={{ display: "grid", gap: "var(--sp-3)" }}>
      <span
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "var(--sp-4)",
        }}
      >
        <span style={{ color: "var(--muted)" }}>{t(`limits.${usage.id}`)}</span>
        <strong>
          {usage.used}
          {usage.limit === null ? t("meterOfUnlimited") : `${t("meterOf")}${usage.limit}`}
        </strong>
      </span>
      <span
        aria-hidden="true"
        style={{
          height: 8,
          borderRadius: "var(--r-pill)",
          background: "var(--surface3)",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            display: "block",
            width: `${Math.round(ratio * 100)}%`,
            height: "100%",
            background: ratio > 0.9 ? "var(--warn)" : "var(--accent)",
          }}
        />
      </span>
    </div>
  );
}

export function DemoPlan({ role }: { role: DemoRole }) {
  const t = useTranslations("plan");
  const format = useDemoFormat();
  const owner = role === "owner";
  const user = owner ? DEMO_OWNER_USER : DEMO_BUYER_USER;
  const usage = owner ? DEMO_OWNER_USAGE : DEMO_BUYER_USAGE;

  const columns: TableColumn<DemoInvoice>[] = [
    {
      id: "number",
      header: t("invoiceNumber"),
      cell: (invoice) => (
        <strong style={{ fontWeight: "var(--fw-medium)" }}>{invoice.number}</strong>
      ),
    },
    {
      id: "date",
      header: t("invoiceDate"),
      width: "150px",
      cell: (invoice) => (
        <span style={{ color: "var(--muted)" }}>{format.date(format.at(-invoice.daysAgo))}</span>
      ),
    },
    {
      id: "total",
      header: t("invoiceTotal"),
      numeric: true,
      align: "left",
      width: "120px",
      cell: (invoice) => format.euroExact(invoice.cents),
    },
    {
      id: "status",
      header: t("invoiceStatusHeader"),
      width: "120px",
      cell: (invoice) => (
        <StatusTag tone={invoice.status === "paid" ? "active" : "pending"}>
          {t(`invoiceStatus.${invoice.status}`)}
        </StatusTag>
      ),
    },
    {
      id: "actions",
      header: t("saveToCloud"),
      width: "130px",
      cell: () => (
        <Button variant="secondary" size="sm">
          {t("saveShort")}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-7)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="secondary" leadingIcon={<ExternalLink size={16} />}>
          {t("managePortal")}
        </Button>
      </div>

      <Card
        padded
        className="upm-demo-panes"
        style={{
          ["--demo-panes" as string]: "minmax(180px, 230px) minmax(0, 1fr)",
          borderTopColor: "var(--accent)",
          borderTopWidth: 3,
        }}
      >
        <div style={{ display: "grid", gap: "var(--sp-2)", alignContent: "start" }}>
          <span
            style={{
              fontSize: "var(--fs-pill)",
              fontWeight: "var(--fw-semibold)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--accent)",
            }}
          >
            {t("currentPlanLabel")}
          </span>
          <strong style={{ fontSize: "var(--fs-title-sm)" }}>{user.planName}</strong>
          <span style={{ color: "var(--muted)" }}>
            {t("renewsOn", {
              interval: t("interval.month"),
              date: format.date(format.at(18)),
            })}
          </span>
          <span style={{ justifySelf: "start" }}>
            <StatusTag tone="active">{t("subscriptionStatus.active")}</StatusTag>
          </span>
        </div>

        <div style={{ display: "grid", gap: "var(--sp-5)", minWidth: 0 }}>
          <div style={{ display: "grid", gap: "var(--sp-1)" }}>
            <strong>{t("usageTitle")}</strong>
            <span style={{ color: "var(--muted)", fontSize: "var(--fs-label)" }}>
              {t("usageHint")}
            </span>
          </div>
          {usage.map((item) => (
            <Meter key={item.id} usage={item} />
          ))}
        </div>
      </Card>

      <div style={{ display: "grid", gap: "var(--sp-5)" }}>
        <strong style={{ fontSize: "var(--fs-subtitle)" }}>{t("invoicesTitle")}</strong>
        <Card>
          <Table
            caption={t("invoicesCaption")}
            columns={columns}
            rows={DEMO_INVOICES}
            rowKey={(invoice) => invoice.id}
          />
        </Card>
      </div>
    </div>
  );
}
