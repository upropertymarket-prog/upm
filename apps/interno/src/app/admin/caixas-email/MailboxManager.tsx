"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Constants, type Enums } from "@upm/db";
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

/**
 * A linha como o ecrã a quer: em camelCase e sem o `secret_id`.
 *
 * **Os campos de enum vêm dos tipos gerados desde 21 out 2026 (D64).** Estavam
 * escritos à mão como uniões de literais, e o `department` tinha ficado atrás:
 * faltava-lhe `marketing`, que entrou no enum a 14 out com a área do Marketing
 * (`20261014120000`). Uma caixa do Marketing não era representável aqui — e o
 * compilador não dizia nada, porque o `database.types.ts` também não conhecia
 * o valor.
 *
 * Os outros três estavam certos e passam a ser derivados pela mesma razão: uma
 * união de literais escrita à mão ao lado de um enum do Postgres é uma cópia
 * que envelhece, e nenhuma destas envelheceu com aviso.
 */
export type MailboxRow = {
  id: string;
  address: string;
  displayName: string;
  protocol: Enums<"mail_protocol">;
  inHost: string;
  inPort: number;
  inSecurity: Enums<"mail_security">;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: Enums<"mail_security">;
  username: string;
  department: Enums<"staff_department">;
  ownerProfileId: string | null;
  status: Enums<"mailbox_status">;
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

/**
 * Só os valores — as etiquetas são chaves de tradução e por isso nascem dentro
 * do componente, onde o `useTranslations` existe.
 */
const SECURITY_VALUES = Constants.public.Enums.mail_security;
/**
 * Do enum, e por isso com `marketing` desde 21 out 2026 (D64).
 *
 * A lista estava escrita à mão com quatro valores e o enum tem cinco desde
 * 14 out (`20261014120000`, com a área do Marketing). O efeito era o
 * departamento que mais e-mail manda ser o único que não podia ter caixa.
 */
const DEPARTMENT_VALUES = Constants.public.Enums.staff_department;

const STATUS_TONE = {
  active: "active",
  paused: "draft",
  error: "rejected",
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
  const t = useTranslations("admin.mailboxes");
  const tCommon = useTranslations("common");
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

  const securityOptions = SECURITY_VALUES.map((value) => ({
    value,
    label: t(`security.${value}`),
  }));
  const departmentOptions = DEPARTMENT_VALUES.map((value) => ({
    value,
    label: t(`departments.${value}`),
  }));

  const columns: TableColumn<MailboxRow>[] = [
    {
      id: "address",
      header: t("columns.mailbox"),
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
      header: t("columns.department"),
      cell: (row) => t(`departments.${row.department}`),
    },
    {
      id: "secret",
      header: t("columns.secret"),
      cell: (row) =>
        row.hasSecret ? (
          <StatusTag tone="active">{t("secretSet")}</StatusTag>
        ) : (
          <StatusTag tone="pending">{t("secretUnset")}</StatusTag>
        ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => (
        <span style={{ display: "grid", gap: "2px" }}>
          <StatusTag tone={STATUS_TONE[row.status]}>{t(`status.${row.status}`)}</StatusTag>
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
          <h1 style={{ margin: 0, fontSize: 22 }}>{t("title")}</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>{t("subtitle")}</p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Button onClick={openNew}>{t("newMailbox")}</Button>
        </div>
      </header>

      {loadError ? (
        <Card padded>
          <strong>{t("loadError")}</strong>
        </Card>
      ) : null}

      <Table
        caption={t("tableCaption")}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={openRow}
        selectedKey={editingId ?? undefined}
        empty={t("tableEmpty")}
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? t("editMailbox") : t("newMailbox")}
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
            label={t("address")}
            type="email"
            value={draft.address}
            onChange={(event) => set("address", event.target.value)}
            placeholder={t("addressPlaceholder")}
          />

          <Input
            label={t("displayName")}
            value={draft.displayName ?? ""}
            onChange={(event) => set("displayName", event.target.value)}
            placeholder={t("displayNamePlaceholder")}
          />

          <Select
            label={t("protocol")}
            hint={t("protocolHint")}
            value={draft.protocol}
            onChange={(event) => setProtocol(event.target.value as "imap" | "pop3")}
            options={[
              { value: "imap", label: t("protocols.imap") },
              { value: "pop3", label: t("protocols.pop3") },
            ]}
          />

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--sp-4)" }}>
            <Input
              label={t("inHost")}
              value={draft.inHost}
              onChange={(event) => set("inHost", event.target.value)}
              placeholder={t("inHostPlaceholder")}
            />
            <Input
              label={t("port")}
              type="number"
              value={String(draft.inPort)}
              onChange={(event) => set("inPort", Number(event.target.value))}
            />
          </div>

          <Select
            label={t("inSecurity")}
            value={draft.inSecurity}
            onChange={(event) =>
              set("inSecurity", event.target.value as MailboxSaveInput["inSecurity"])
            }
            options={securityOptions}
          />

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--sp-4)" }}>
            <Input
              label={t("smtpHost")}
              value={draft.smtpHost}
              onChange={(event) => set("smtpHost", event.target.value)}
              placeholder={t("smtpHostPlaceholder")}
            />
            <Input
              label={t("port")}
              type="number"
              value={String(draft.smtpPort)}
              onChange={(event) => set("smtpPort", Number(event.target.value))}
            />
          </div>

          <Select
            label={t("smtpSecurity")}
            value={draft.smtpSecurity}
            onChange={(event) =>
              set("smtpSecurity", event.target.value as MailboxSaveInput["smtpSecurity"])
            }
            options={securityOptions}
          />

          <Input
            label={t("username")}
            hint={t("usernameHint")}
            value={draft.username}
            onChange={(event) => set("username", event.target.value)}
          />

          <Select
            label={t("department")}
            value={draft.department}
            onChange={(event) =>
              set("department", event.target.value as MailboxSaveInput["department"])
            }
            options={departmentOptions}
          />

          <Select
            label={t("owner")}
            hint={t("ownerHint")}
            value={draft.ownerProfileId ?? ""}
            onChange={(event) => set("ownerProfileId", event.target.value || null)}
            options={[
              { value: "", label: t("ownerNone") },
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
              {editingId ? tCommon("saveChanges") : t("createMailbox")}
            </Button>
            {editingId ? (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => startBusy(async () => setResult(await onTest(editingId)))}
              >
                {t("testConnection")}
              </Button>
            ) : null}
          </div>

          {/* Ver a nota de topo: formulário próprio, campo sempre vazio. */}
          {editingId ? (
            <Card padded>
              <div style={{ display: "grid", gap: "var(--sp-4)" }}>
                <div style={{ display: "grid", gap: "var(--sp-2)" }}>
                  <strong>{t("passwordTitle")}</strong>
                  <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
                    {t("passwordNote")}
                  </span>
                </div>
                <Input
                  label={t("newPassword")}
                  type="password"
                  revealLabels={{ show: tCommon("showPassword"), hide: tCommon("hidePassword") }}
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
                    {t("savePassword")}
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
