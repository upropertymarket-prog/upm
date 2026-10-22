"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, resolveLocale } from "@upm/config";
import { FilePlus2, FileSignature } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  StatusTag,
  Table,
  Tabs,
  useToast,
  type TableColumn,
} from "@upm/ui";
import { CONTRACT_KINDS, CONTRACT_STATUS_TONES, type ContractKind } from "@upm/db/cloud";

import {
  formatDateTime,
  type ContractRow,
  type ContractSharedWithMeRow,
  type TemplateRow,
} from "./contractTypes";
import { useCanvasSafeRouter } from "../../lib/useCanvasSafeRouter";

export type ContractsScreenProps = {
  contracts: ContractRow[];
  templates: TemplateRow[];
  sharedWithMe: ContractSharedWithMeRow[];
  /** Imóveis do proprietário, para associar o contrato a um deles. */
  properties: { id: string; title: string }[];
  canCreate: boolean;
  onCreate: (input: {
    templateId: string;
    title: string;
    propertyId?: string;
    counterpartyName?: string;
  }) => Promise<{ error?: string; id?: string }>;
};

/**
 * Contratos — `/contratos` (P6-03 · 04 §8.3 · 07 §19.10)
 * =========================================================================
 * As duas tabs de 04 §8.3 — **Contratos** e **Modelos** — e uma terceira que o
 * doc pede noutro sítio: os contratos que alguém partilhou connosco (07 §5.5),
 * que aparecem aqui em leitura e não noutro ecrã.
 *
 * Os modelos mostram-se **lado a lado por tipo**, Compra e venda à esquerda e
 * Arrendamento à direita, como a referência. E são só de leitura para quem está
 * nesta app: publicar e versionar modelos é do Admin (P6-04). O que se faz a
 * partir de um modelo é gerar um contrato.
 */
export function ContractsScreen({
  contracts,
  templates,
  sharedWithMe,
  properties,
  canCreate,
  onCreate,
}: ContractsScreenProps) {
  const t = useTranslations("contracts.screen");
  const tKind = useTranslations("contracts.kind");
  const tStatus = useTranslations("contracts.status");
  const tCommon = useTranslations("common");
  const intlLocale = INTL_LOCALE[resolveLocale(useLocale())];
  const [tab, setTab] = useState<"contracts" | "templates" | "shared">(
    contracts.length === 0 && canCreate ? "templates" : "contracts",
  );
  const [creating, setCreating] = useState<TemplateRow | null>(null);
  const [title, setTitle] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [pending, startTransition] = useTransition();
  // Ver `useCanvasSafeRouter`: no canvas não há router, e o do Next atira.
  const router = useCanvasSafeRouter();
  const { toast } = useToast();

  function open(contractId: string) {
    router?.push(`/contratos?contrato=${contractId}`);
  }

  function create() {
    if (!creating) return;
    const template = creating;
    startTransition(async () => {
      const result = await onCreate({
        templateId: template.id,
        title: title.trim() || template.name,
        propertyId: propertyId || undefined,
        counterpartyName: counterparty.trim() || undefined,
      });
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setCreating(null);
      setTitle("");
      setPropertyId("");
      setCounterparty("");
      if (result.id) open(result.id);
    });
  }

  const columns: TableColumn<ContractRow>[] = [
    {
      id: "title",
      header: t("columnContract"),
      cell: (row) => (
        <div style={{ display: "grid", minWidth: 0 }}>
          <strong>{row.title}</strong>
          <span style={{ color: "var(--muted)" }}>
            {tKind(row.kind)}
            {row.propertyTitle ? ` · ${row.propertyTitle}` : ""}
          </span>
        </div>
      ),
    },
    {
      id: "counterparty",
      header: t("columnCounterparty"),
      cell: (row) => (
        <span style={{ color: "var(--muted)" }}>
          {row.counterpartyName || t("counterpartyUnset")}
        </span>
      ),
    },
    {
      id: "status",
      header: t("columnStatus"),
      cell: (row) => (
        <StatusTag tone={CONTRACT_STATUS_TONES[row.status] as never}>
          {tStatus(row.status)}
        </StatusTag>
      ),
    },
    {
      id: "updated",
      header: t("columnUpdated"),
      cell: (row) => (
        <span style={{ color: "var(--muted)" }}>{formatDateTime(row.updatedAt, intlLocale)}</span>
      ),
    },
    {
      id: "actions",
      header: t("columnActions"),
      cell: (row) => (
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Button variant="secondary" size="md" onClick={() => open(row.id)}>
            {t("open")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-7)" }}>
      <Tabs
        label={t("tabsLabel")}
        value={tab}
        onValueChange={(next) => setTab(next as typeof tab)}
        items={[
          { id: "contracts", label: t("tabContracts"), count: contracts.length },
          ...(canCreate
            ? [{ id: "templates", label: t("tabTemplates"), count: templates.length }]
            : []),
          { id: "shared", label: t("tabShared"), count: sharedWithMe.length },
        ]}
      />

      {tab === "contracts" ? (
        contracts.length === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            description={canCreate ? t("emptyBodyOwner") : t("emptyBodyBuyer")}
          />
        ) : (
          <Card>
            <Table
              caption={t("tableCaption")}
              columns={columns}
              rows={contracts}
              rowKey={(row) => row.id}
              empty={t("tableEmpty")}
            />
          </Card>
        )
      ) : null}

      {tab === "templates" && canCreate ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
            gap: "var(--sp-6)",
            alignItems: "start",
          }}
        >
          {CONTRACT_KINDS.map((kind) => (
            <TemplateColumn
              key={kind}
              kind={kind}
              templates={templates.filter((template) => template.kind === kind)}
              onPick={(template) => {
                setCreating(template);
                setTitle(template.name);
              }}
            />
          ))}
        </div>
      ) : null}

      {tab === "shared" ? (
        sharedWithMe.length === 0 ? (
          <EmptyState title={t("sharedEmptyTitle")} description={t("sharedEmptyBody")} />
        ) : (
          <Card>
            <Table
              caption={t("sharedCaption")}
              rows={sharedWithMe}
              rowKey={(row) => row.shareId}
              empty={t("sharedTableEmpty")}
              columns={[
                {
                  id: "title",
                  header: t("columnContract"),
                  cell: (row) => (
                    <div style={{ display: "grid", minWidth: 0 }}>
                      <strong>{row.title}</strong>
                      <span style={{ color: "var(--muted)" }}>
                        {tKind(row.kind)} · {t("sharedBy", { name: row.sharedByName })}
                      </span>
                    </div>
                  ),
                },
                {
                  id: "status",
                  header: t("columnStatus"),
                  cell: (row) => (
                    <StatusTag tone={CONTRACT_STATUS_TONES[row.status] as never}>
                      {tStatus(row.status)}
                    </StatusTag>
                  ),
                },
                {
                  id: "expires",
                  header: t("columnExpires"),
                  cell: (row) => (
                    <span style={{ color: "var(--muted)" }}>
                      {row.expiresAt ? formatDateTime(row.expiresAt, intlLocale) : t("noExpiry")}
                    </span>
                  ),
                },
                {
                  id: "actions",
                  header: t("columnActions"),
                  cell: (row) => (
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Button variant="ghost" size="sm" onClick={() => open(row.contractId)}>
                        {t("view")}
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        )
      ) : null}

      <Modal
        open={creating !== null}
        onClose={() => setCreating(null)}
        title={t("newContract")}
        subtitle={creating ? t("fromTemplate", { name: creating.name }) : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(null)}>
              {tCommon("cancel")}
            </Button>
            <Button disabled={pending || title.trim().length === 0} onClick={create}>
              {t("createAndOpen")}
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: "var(--sp-6)" }}>
          <Input
            label={t("titleLabel")}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
          />
          {properties.length > 0 ? (
            <Select
              label={t("propertyLabel")}
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              placeholder={t("propertyPlaceholder")}
              options={properties.map((property) => ({
                value: property.id,
                label: property.title,
              }))}
            />
          ) : null}
          <Input
            label={t("counterpartyLabel")}
            value={counterparty}
            onChange={(event) => setCounterparty(event.target.value)}
            placeholder={t("counterpartyPlaceholder")}
            hint={t("counterpartyHint")}
            maxLength={160}
          />
        </div>
      </Modal>
    </div>
  );
}

function TemplateColumn({
  kind,
  templates,
  onPick,
}: {
  kind: ContractKind;
  templates: TemplateRow[];
  onPick: (template: TemplateRow) => void;
}) {
  const t = useTranslations("contracts.screen");
  const tKind = useTranslations("contracts.kind");
  return (
    <Card padded style={{ display: "grid", gap: "var(--sp-5)" }}>
      <strong style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <FileSignature size={16} aria-hidden="true" />
        {tKind(kind)}
      </strong>

      {templates.length === 0 ? (
        <span style={{ color: "var(--muted)" }}>{t("noTemplates")}</span>
      ) : (
        templates.map((template) => (
          <div
            key={template.id}
            style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}
          >
            <div style={{ display: "grid", flex: 1, minWidth: 0 }}>
              <span>{template.name}</span>
              <span style={{ color: "var(--muted)" }}>
                {t("templateMeta", {
                  version: String(template.version),
                  count: String(template.variables.length),
                })}
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<FilePlus2 size={15} />}
              onClick={() => onPick(template)}
            >
              {t("use")}
            </Button>
          </div>
        ))
      )}
    </Card>
  );
}
