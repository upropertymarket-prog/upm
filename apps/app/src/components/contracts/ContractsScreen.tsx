"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import {
  CONTRACT_KINDS,
  CONTRACT_KIND_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONES,
  type ContractKind,
} from "@upm/db/cloud";

import {
  formatDateTime,
  type ContractRow,
  type ContractSharedWithMeRow,
  type TemplateRow,
} from "./contractTypes";

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
  const [tab, setTab] = useState<"contracts" | "templates" | "shared">(
    contracts.length === 0 && canCreate ? "templates" : "contracts",
  );
  const [creating, setCreating] = useState<TemplateRow | null>(null);
  const [title, setTitle] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  function open(contractId: string) {
    router.push(`/contratos?contrato=${contractId}`);
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
      header: "Contrato",
      cell: (row) => (
        <div style={{ display: "grid", minWidth: 0 }}>
          <strong>{row.title}</strong>
          <span style={{ color: "var(--muted)" }}>
            {CONTRACT_KIND_LABELS[row.kind]}
            {row.propertyTitle ? ` · ${row.propertyTitle}` : ""}
          </span>
        </div>
      ),
    },
    {
      id: "counterparty",
      header: "Contraparte",
      cell: (row) => (
        <span style={{ color: "var(--muted)" }}>{row.counterpartyName || "Por definir"}</span>
      ),
    },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <StatusTag tone={CONTRACT_STATUS_TONES[row.status] as never}>
          {CONTRACT_STATUS_LABELS[row.status]}
        </StatusTag>
      ),
    },
    {
      id: "updated",
      header: "Atualizado",
      cell: (row) => <span style={{ color: "var(--muted)" }}>{formatDateTime(row.updatedAt)}</span>,
    },
    {
      id: "actions",
      header: "Ações",
      cell: (row) => (
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Button variant="secondary" size="md" onClick={() => open(row.id)}>
            Abrir
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-7)" }}>
      <Tabs
        label="Contratos e modelos"
        value={tab}
        onValueChange={(next) => setTab(next as typeof tab)}
        items={[
          { id: "contracts", label: "Contratos", count: contracts.length },
          ...(canCreate ? [{ id: "templates", label: "Modelos", count: templates.length }] : []),
          { id: "shared", label: "Partilhados comigo", count: sharedWithMe.length },
        ]}
      />

      {tab === "contracts" ? (
        contracts.length === 0 ? (
          <EmptyState
            title="Ainda sem contratos"
            description={
              canCreate
                ? "Escolha um modelo para gerar o primeiro contrato — compra e venda ou arrendamento."
                : "Os contratos que lhe partilharem aparecem no separador ao lado."
            }
          />
        ) : (
          <Card>
            <Table
              caption="Os meus contratos"
              columns={columns}
              rows={contracts}
              rowKey={(row) => row.id}
              empty="Nenhum contrato."
            />
          </Card>
        )
      ) : null}

      {tab === "templates" && canCreate ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
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
          <EmptyState
            title="Nada partilhado consigo"
            description="Um contrato que lhe partilhem aparece aqui, em leitura."
          />
        ) : (
          <Card>
            <Table
              caption="Contratos partilhados comigo"
              rows={sharedWithMe}
              rowKey={(row) => row.shareId}
              empty="Nada partilhado consigo."
              columns={[
                {
                  id: "title",
                  header: "Contrato",
                  cell: (row) => (
                    <div style={{ display: "grid", minWidth: 0 }}>
                      <strong>{row.title}</strong>
                      <span style={{ color: "var(--muted)" }}>
                        {CONTRACT_KIND_LABELS[row.kind]} · de {row.sharedByName}
                      </span>
                    </div>
                  ),
                },
                {
                  id: "status",
                  header: "Estado",
                  cell: (row) => (
                    <StatusTag tone={CONTRACT_STATUS_TONES[row.status] as never}>
                      {CONTRACT_STATUS_LABELS[row.status]}
                    </StatusTag>
                  ),
                },
                {
                  id: "expires",
                  header: "Expira",
                  cell: (row) => (
                    <span style={{ color: "var(--muted)" }}>
                      {row.expiresAt ? formatDateTime(row.expiresAt) : "Sem expirar"}
                    </span>
                  ),
                },
                {
                  id: "actions",
                  header: "Ações",
                  cell: (row) => (
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Button variant="ghost" size="sm" onClick={() => open(row.contractId)}>
                        Ver
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
        title="Novo contrato"
        subtitle={creating ? `A partir de "${creating.name}"` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(null)}>
              Cancelar
            </Button>
            <Button disabled={pending || title.trim().length === 0} onClick={create}>
              Criar e abrir
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: "var(--sp-6)" }}>
          <Input
            label="Título"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
          />
          {properties.length > 0 ? (
            <Select
              label="Imóvel"
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              placeholder="Sem imóvel associado"
              options={properties.map((property) => ({
                value: property.id,
                label: property.title,
              }))}
            />
          ) : null}
          <Input
            label="Contraparte"
            value={counterparty}
            onChange={(event) => setCounterparty(event.target.value)}
            placeholder="Nome de quem assina do outro lado"
            hint="Pode ficar por preencher e completar-se depois."
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
  return (
    <Card padded style={{ display: "grid", gap: "var(--sp-5)" }}>
      <strong style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <FileSignature size={16} aria-hidden="true" />
        {CONTRACT_KIND_LABELS[kind]}
      </strong>

      {templates.length === 0 ? (
        <span style={{ color: "var(--muted)" }}>Ainda não há modelos publicados deste tipo.</span>
      ) : (
        templates.map((template) => (
          <div
            key={template.id}
            style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}
          >
            <div style={{ display: "grid", flex: 1, minWidth: 0 }}>
              <span>{template.name}</span>
              <span style={{ color: "var(--muted)" }}>
                versão {template.version} · {template.variables.length} variáveis
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<FilePlus2 size={15} />}
              onClick={() => onPick(template)}
            >
              Usar
            </Button>
          </div>
        ))
      )}
    </Card>
  );
}
