"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Card,
  EmptyState,
  StatusTag,
  Table,
  Tabs,
  type StatusTone,
  type TableColumn,
} from "@upm/ui";
import { DEMO_BUYER_CONTRACTS, DEMO_OWNER_CONTRACTS, type DemoContract } from "@upm/ui/demo-data";

import { useDemoFormat, type DemoRole } from "./format";

/**
 * Contratos da demonstração — 07 §19.10
 * =========================================================================
 * Os separadores de `ContractsScreen`: os meus contratos, os modelos (só o
 * proprietário os tem) e os que me partilharam. O comprador vê sobretudo o
 * terceiro — é esse o lado dele desta funcionalidade.
 *
 * O editor não entra: é uma página inteira, com variáveis, versões e
 * exportação em PDF, e cabe tão pouco nesta caixa como um calendário mensal.
 * O que o visitante precisa de perceber aqui é que existem contratos, com
 * estado, e que o ciclo não anda para trás.
 */

const STATUS_TONE: Record<DemoContract["status"], StatusTone> = {
  draft: "draft",
  shared: "primary",
  awaiting_signature: "pending",
  signed: "active",
  completed: "archived",
};

export function DemoContracts({ role }: { role: DemoRole }) {
  const t = useTranslations("contracts.screen");
  const tStatus = useTranslations("contracts.status");
  const tKind = useTranslations("contracts.kind");
  const format = useDemoFormat();
  const owner = role === "owner";
  const [tab, setTab] = useState(owner ? "contracts" : "shared");

  const mine = owner ? DEMO_OWNER_CONTRACTS : [];
  const shared = owner ? [] : DEMO_BUYER_CONTRACTS;
  const rows = tab === "contracts" ? mine : shared;

  const columns: TableColumn<DemoContract>[] = [
    {
      id: "title",
      header: t("columnContract"),
      cell: (contract) => (
        <div style={{ display: "grid", gap: "var(--sp-1)", minWidth: 0 }}>
          <strong style={{ fontWeight: "var(--fw-medium)" }}>{contract.title}</strong>
          <span style={{ color: "var(--muted)", fontSize: "var(--fs-label)" }}>
            {tKind(contract.kind)}
          </span>
        </div>
      ),
    },
    {
      id: "counterparty",
      header: t("columnCounterparty"),
      width: "170px",
      cell: (contract) => (
        <span style={{ color: "var(--muted)" }}>
          {contract.counterparty || t("counterpartyUnset")}
        </span>
      ),
    },
    {
      id: "status",
      header: t("columnStatus"),
      width: "150px",
      cell: (contract) => (
        <StatusTag tone={STATUS_TONE[contract.status]}>{tStatus(contract.status)}</StatusTag>
      ),
    },
    {
      id: "updated",
      header: t("columnUpdated"),
      width: "140px",
      cell: (contract) => (
        <span style={{ color: "var(--muted)" }}>{format.ago(contract.hoursAgo * 60)}</span>
      ),
    },
    {
      id: "actions",
      header: t("columnActions"),
      width: "120px",
      cell: () => (
        <Button variant="secondary" size="md">
          {owner ? t("open") : t("view")}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "var(--sp-5)",
          flexWrap: "wrap",
        }}
      >
        <Tabs
          label={t("tabsLabel")}
          value={tab}
          onValueChange={setTab}
          items={[
            ...(owner ? [{ id: "contracts", label: t("tabContracts"), count: mine.length }] : []),
            { id: "shared", label: t("tabShared"), count: shared.length },
          ]}
        />
        {owner ? <Button variant="secondary">{t("newContract")}</Button> : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={tab === "shared" ? t("sharedEmptyTitle") : t("emptyTitle")}
          description={tab === "shared" ? t("sharedEmptyBody") : t("emptyBodyOwner")}
        />
      ) : (
        <Card>
          <Table
            caption={tab === "shared" ? t("sharedCaption") : t("tableCaption")}
            columns={columns}
            rows={rows}
            rowKey={(contract) => contract.id}
            empty={t("tableEmpty")}
          />
        </Card>
      )}
    </div>
  );
}
