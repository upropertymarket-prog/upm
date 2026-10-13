"use client";

import { useState, useTransition } from "react";
import { Button, Card, Drawer, Input, Select, StatusTag, Table } from "@upm/ui";
import type { TableColumn } from "@upm/ui";

import type { MailboxActionResult, MailboxSaveInput } from "./actions";

/**
 * Caixas de e-mail do Suporte — `/admin/caixas-email` (P10-03 · 04 §2.5)
 * =========================================================================
 * Lista à esquerda, editor num painel lateral à direita: o padrão de 04 §1.4
 * para "ver/editar registo vindo de uma lista", o mesmo das leads, dos
 * utilizadores e do SEO. Não é um modal — configurar uma caixa é preencher
 * doze campos a olhar para o que o fornecedor documenta, não uma decisão
 * curta.
 *
 * ## A palavra-passe tem um formulário só para ela, e é de propósito
 *
 * O resto da configuração guarda-se de uma vez; a credencial tem o seu próprio
 * campo e o seu próprio botão. Três razões, por ordem de importância:
 *
 *  1. **Não se reenvia o que não mudou.** Se a palavra-passe viajasse no mesmo
 *     formulário, cada gravação de "mudei o porto SMTP" mandava a credencial
 *     outra vez pela rede. Separada, só viaja quando é mesmo substituída.
 *  2. **Não há nada para pré-preencher.** O campo nasce sempre vazio porque o
 *     valor não é legível — nem por este ecrã, nem por ninguém sem
 *     `service_role`. O que a lista mostra é "definida" ou "por definir".
 *  3. **O registo de auditoria fica honesto.** `mailbox.secret_updated` é uma
 *     entrada distinta de `mailbox.updated`, e sem `diff`.
 *
 * ## Os valores por omissão dos portos
 *
 * Mudam com o protocolo e com a segurança, e um campo vazio num ecrã destes é
 * um convite a inventar. Preenchem-se sozinhos quando se troca o protocolo —
 * mas continuam editáveis, porque há fornecedores com portos próprios e
 * recusá-los seria decidir pelo administrador.
 */

export type MailboxRow = {
  id: string;
  address: string;
  displayName: string;
  protocol: "imap" | "pop3";
  inHost: string;
  inPort: number;
  inSecurity: "ssl_tls" | "starttls" | "none";
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: "ssl_tls" | "starttls" | "none";
  username: string;
  department: "suporte" | "financeiro" | "moderacao" | "admin";
  ownerProfileId: string | null;
  status: "active" | "paused" | "error";
  /** Derivado de `secret_id is not null` — nunca o segredo. */
  hasSecret: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
};

export type StaffOption = { id: string; name: string };

/** Portos de entrada por omissão. `pop3` seguro é 995, `imap` é 993. */
const DEFAULT_IN_PORT = { imap: 993, pop3: 995 } as const;
const DEFAULT_SMTP_PORT = 587;

const EMPTY: MailboxSaveInput = {
  address: "",
  displayName: "",
  protocol: "imap",
  inHost: "",
  inPort: DEFAULT_IN_PORT.imap,
  inSecurity: "ssl_tls",
  smtpHost: "",
  smtpPort: DEFAULT_SMTP_PORT,
  smtpSecurity: "starttls",
  username: "",
  department: "suporte",
  ownerProfileId: null,
  status: "active",
};

const SECURITY_OPTIONS = [
  { value: "ssl_tls", label: "SSL/TLS" },
  { value: "starttls", label: "STARTTLS" },
  { value: "none", label: "Sem encriptação" },
];

const DEPARTMENT_OPTIONS = [
  { value: "suporte", label: "Suporte" },
  { value: "financeiro", label: "Financeiro" },
  { value: "moderacao", label: "Moderação" },
  { value: "admin", label: "Administração" },
];

const STATUS_LABEL = {
  active: { tone: "active", label: "Ativa" },
  paused: { tone: "draft", label: "Em pausa" },
  error: { tone: "rejected", label: "Com erro" },
} as const;

function toInput(row: MailboxRow): MailboxSaveInput {
  return {
    id: row.id,
    address: row.address,
    displayName: row.displayName,
    protocol: row.protocol,
    inHost: row.inHost,
    inPort: row.inPort,
    inSecurity: row.inSecurity,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecurity: row.smtpSecurity,
    username: row.username,
    department: row.department,
    ownerProfileId: row.ownerProfileId,
    status: row.status,
  };
}

export function MailboxManager({
  rows,
  staff,
  loadError,
  onSave,
  onSaveSecret,
  onTest,
}: {
  rows: MailboxRow[];
  staff: StaffOption[];
  loadError: boolean;
  onSave: (input: MailboxSaveInput) => Promise<MailboxActionResult>;
  onSaveSecret: (input: { id: string; password: string }) => Promise<MailboxActionResult>;
  onTest: (mailboxId: string) => Promise<MailboxActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MailboxSaveInput>(EMPTY);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<MailboxActionResult>({});
  const [busy, startBusy] = useTransition();

  function openNew() {
    setEditingId(null);
    setDraft(EMPTY);
    setPassword("");
    setResult({});
    setOpen(true);
  }

  function openRow(row: MailboxRow) {
    setEditingId(row.id);
    setDraft(toInput(row));
    setPassword("");
    setResult({});
    setOpen(true);
  }

  const set = <K extends keyof MailboxSaveInput>(key: K, value: MailboxSaveInput[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));

  /** Trocar de protocolo arrasta o porto de entrada, se ele ainda for o antigo. */
  function setProtocol(protocol: "imap" | "pop3") {
    setDraft((previous) => ({
      ...previous,
      protocol,
      inPort:
        previous.inPort === DEFAULT_IN_PORT[previous.protocol as "imap" | "pop3"]
          ? DEFAULT_IN_PORT[protocol]
          : previous.inPort,
    }));
  }

  const columns: TableColumn<MailboxRow>[] = [
    {
      id: "address",
      header: "Caixa",
      cell: (row) => (
        <span style={{ display: "grid", gap: "2px" }}>
          <strong style={{ color: "var(--text)" }}>{row.address}</strong>
          <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
            {row.displayName || "—"} · {row.protocol.toUpperCase()}
          </span>
        </span>
      ),
    },
    {
      id: "department",
      header: "Departamento",
      cell: (row) => DEPARTMENT_OPTIONS.find((d) => d.value === row.department)?.label ?? "—",
    },
    {
      id: "secret",
      header: "Credencial",
      cell: (row) =>
        row.hasSecret ? (
          <StatusTag tone="active">Definida</StatusTag>
        ) : (
          <StatusTag tone="pending">Por definir</StatusTag>
        ),
    },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span style={{ display: "grid", gap: "2px" }}>
          <StatusTag tone={STATUS_LABEL[row.status].tone}>
            {STATUS_LABEL[row.status].label}
          </StatusTag>
          {row.lastError ? (
            <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
              {row.lastError}
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: "grid", gap: "var(--sp-6)" }}>
      <header
        style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", flexWrap: "wrap" }}
      >
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Configuração de e-mail</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            As caixas que o Suporte lê e de onde responde. As credenciais ficam no Vault, nunca na
            base de dados.
          </p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Button onClick={openNew}>Nova caixa</Button>
        </div>
      </header>

      {loadError ? (
        <Card padded>
          <strong>Não foi possível carregar as caixas de e-mail.</strong>
        </Card>
      ) : null}

      <Table
        caption="Caixas de e-mail configuradas"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={openRow}
        selectedKey={editingId ?? undefined}
        empty="Ainda não há nenhuma caixa configurada."
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Editar caixa" : "Nova caixa"}
      >
        <div style={{ display: "grid", gap: "var(--sp-5)" }}>
          {result.error ? (
            <Card padded>
              <span style={{ color: "var(--danger)" }}>{result.error}</span>
            </Card>
          ) : null}
          {result.notice ? (
            <Card padded>
              <span>{result.notice}</span>
            </Card>
          ) : null}

          <Input
            label="Endereço"
            type="email"
            value={draft.address}
            onChange={(event) => set("address", event.target.value)}
            placeholder="suporte@upropertymarket.pt"
          />

          <Input
            label="Nome a apresentar"
            value={draft.displayName ?? ""}
            onChange={(event) => set("displayName", event.target.value)}
            placeholder="Suporte UProperty"
          />

          <Select
            label="Protocolo de entrada"
            hint="IMAP mantém o estado no servidor e é o recomendado; POP3 descarrega e apaga."
            value={draft.protocol}
            onChange={(event) => setProtocol(event.target.value as "imap" | "pop3")}
            options={[
              { value: "imap", label: "IMAP (recomendado)" },
              { value: "pop3", label: "POP3" },
            ]}
          />

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--sp-4)" }}>
            <Input
              label="Servidor de entrada"
              value={draft.inHost}
              onChange={(event) => set("inHost", event.target.value)}
              placeholder="imap.exemplo.pt"
            />
            <Input
              label="Porto"
              type="number"
              value={String(draft.inPort)}
              onChange={(event) => set("inPort", Number(event.target.value))}
            />
          </div>

          <Select
            label="Segurança da entrada"
            value={draft.inSecurity}
            onChange={(event) =>
              set("inSecurity", event.target.value as MailboxSaveInput["inSecurity"])
            }
            options={SECURITY_OPTIONS}
          />

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--sp-4)" }}>
            <Input
              label="Servidor SMTP"
              value={draft.smtpHost}
              onChange={(event) => set("smtpHost", event.target.value)}
              placeholder="smtp.exemplo.pt"
            />
            <Input
              label="Porto"
              type="number"
              value={String(draft.smtpPort)}
              onChange={(event) => set("smtpPort", Number(event.target.value))}
            />
          </div>

          <Select
            label="Segurança do SMTP"
            value={draft.smtpSecurity}
            onChange={(event) =>
              set("smtpSecurity", event.target.value as MailboxSaveInput["smtpSecurity"])
            }
            options={SECURITY_OPTIONS}
          />

          <Input
            label="Utilizador"
            hint="Normalmente é o próprio endereço."
            value={draft.username}
            onChange={(event) => set("username", event.target.value)}
          />

          <Select
            label="Departamento"
            value={draft.department}
            onChange={(event) =>
              set("department", event.target.value as MailboxSaveInput["department"])
            }
            options={DEPARTMENT_OPTIONS}
          />

          <Select
            label="Responsável"
            hint="De quem saem as variáveis da assinatura."
            value={draft.ownerProfileId ?? ""}
            onChange={(event) => set("ownerProfileId", event.target.value || null)}
            options={[
              { value: "", label: "Sem responsável" },
              ...staff.map((person) => ({ value: person.id, label: person.name })),
            ]}
          />

          <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
            <Button
              disabled={busy}
              onClick={() =>
                startBusy(async () => {
                  const next = await onSave({ ...draft, id: editingId ?? undefined });
                  setResult(next);
                  if (next.ok && !editingId) setOpen(false);
                })
              }
            >
              {editingId ? "Guardar alterações" : "Criar caixa"}
            </Button>
            {editingId ? (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => startBusy(async () => setResult(await onTest(editingId)))}
              >
                Testar ligação
              </Button>
            ) : null}
          </div>

          {/* Ver a nota de topo: formulário próprio, campo sempre vazio. */}
          {editingId ? (
            <Card padded>
              <div style={{ display: "grid", gap: "var(--sp-4)" }}>
                <div style={{ display: "grid", gap: "var(--sp-2)" }}>
                  <strong>Palavra-passe</strong>
                  <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
                    Guardada no Supabase Vault. Não é legível a partir daqui — para a mudar, escreva
                    a nova.
                  </span>
                </div>
                <Input
                  label="Nova palavra-passe"
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  onChange={(event) => setPassword(event.target.value)}
                />
                <div>
                  <Button
                    variant="secondary"
                    disabled={busy || password.length === 0}
                    onClick={() =>
                      startBusy(async () => {
                        const next = await onSaveSecret({ id: editingId, password });
                        setResult(next);
                        if (next.ok) setPassword("");
                      })
                    }
                  >
                    Guardar palavra-passe
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </Drawer>
    </div>
  );
}
