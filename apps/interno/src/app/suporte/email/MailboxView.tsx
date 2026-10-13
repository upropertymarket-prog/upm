"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Archive,
  Inbox,
  LifeBuoy,
  Mail,
  MailOpen,
  Paperclip,
  Search,
  Star,
  Tag,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  StatusTag,
  useToast,
  type StatusTone,
} from "@upm/ui";
import type {
  MailFolder,
  MailLabelRow,
  MailListItem,
  MailMessageRow,
  MailboxOption,
} from "@upm/db/mail";

import type { MailActionResult } from "./actions";

/**
 * Caixa de e-mail do Suporte — `/suporte/email` (P10-04 · 04 §2.5)
 * =========================================================================
 * Três colunas, pela ordem em que se trabalha: **onde estou** (caixa, pastas,
 * marcadores) → **o que há** (lista) → **o que diz** (leitura). É o desenho de
 * 04 §2.5, e é também a razão de não ser um drawer: quem trata correio precisa
 * da fila à vista, como nos tickets.
 *
 * ## O corpo do e-mail vive dentro de um iframe com `sandbox`
 *
 * 02 §4.3 é explícito — "e-mails recebidos renderizados em iframe sandbox" — e
 * é a única defesa que não depende de acertarmos numa lista de etiquetas
 * permitidas. O HTML de um e-mail é texto de um estranho: pode trazer
 * `<script>`, `<form>` para um site de phishing, CSS que cobre a página ou um
 * `<a target=_top>` que navega a aplicação inteira. Com `sandbox` vazio não
 * corre JavaScript, não submete formulários, não navega o pai e não herda a
 * nossa origem — logo não alcança a sessão de quem está a ler.
 *
 * `srcDoc` e não `src`: o conteúdo vem connosco, não de um pedido ao servidor
 * do remetente — um `src` remoto confirmaria a leitura a quem enviou, que é
 * precisamente o que o bloqueio de imagens externas existe para evitar.
 *
 * ## O que esta tarefa **não** traz, e porquê não há botão
 *
 * Responder e "Novo e-mail" são o composer de P10-05. Não há aqui um botão
 * desativado à espera: um botão que não faz nada é uma promessa partida, e o
 * ecrã é honesto sobre o que já sabe fazer.
 */

const LABEL_TONES: Record<string, StatusTone> = {
  accent: "draft",
  success: "active",
  warning: "pending",
  danger: "rejected",
  info: "ticketProgress",
  muted: "archived",
};

const FOLDER_ICONS: Record<MailFolder, typeof Inbox> = {
  inbox: Inbox,
  archive: Archive,
  sent: Mail,
  drafts: Mail,
};

export type MailboxViewProps = {
  mailboxes: MailboxOption[];
  mailboxId: string | null;
  folder: MailFolder;
  labels: MailLabelRow[];
  labelId: string | null;
  search: string;
  starred: boolean;
  messages: MailListItem[];
  selected: MailMessageRow | null;
  counts: { inbox: number; archive: number; unread: number; starred: number };
  locale: string;
  onFlags: (input: {
    messageId: string;
    isRead?: boolean;
    isStarred?: boolean;
  }) => Promise<MailActionResult>;
  onMove: (input: { messageId: string; folder: "inbox" | "archive" }) => Promise<MailActionResult>;
  onCreateLabel: (input: { mailboxId: string; name: string }) => Promise<MailActionResult>;
  onToggleLabel: (input: { messageId: string; labelId: string }) => Promise<MailActionResult>;
  onCreateTicket: (messageId: string) => Promise<MailActionResult>;
};

export function MailboxView(props: MailboxViewProps) {
  const t = useTranslations("support.mailbox");
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState(props.search);
  const [newLabel, setNewLabel] = useState("");
  const [pending, startTransition] = useTransition();

  const dateFormat = new Intl.DateTimeFormat(props.locale === "en" ? "en-IE" : "pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  });

  function go(next: Partial<Record<string, string | null>>) {
    const params = new URLSearchParams();
    const base: Record<string, string | null> = {
      caixa: props.mailboxId,
      pasta: props.folder,
      marcador: props.labelId,
      q: query || null,
      estrela: props.starred ? "1" : null,
      id: null,
      ...next,
    };
    for (const [key, value] of Object.entries(base)) {
      if (value) params.set(key, value);
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  /** Toda a escrita passa por aqui: o mesmo tratamento de erro e o mesmo refresh. */
  function run(action: () => Promise<MailActionResult>, success?: string) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      if (success ?? result.notice) toast(success ?? result.notice!, "success");
      router.refresh();
    });
  }

  if (props.mailboxes.length === 0) {
    return (
      <Card padded>
        <EmptyState title={t("noMailboxTitle")} description={t("noMailboxBody")} />
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--sp-5)" }}>
      <div
        style={{
          display: "flex",
          gap: "var(--sp-4)",
          alignItems: "flex-end",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <Select
          label={t("mailboxLabel")}
          value={props.mailboxId ?? ""}
          onChange={(event) => go({ caixa: event.target.value, id: null, marcador: null })}
          options={props.mailboxes.map((box) => ({
            value: box.id,
            label: box.displayName ? `${box.displayName} · ${box.address}` : box.address,
          }))}
        />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            go({ q: query || null });
          }}
          style={{ display: "flex", gap: "var(--sp-2)", alignItems: "flex-end" }}
        >
          <Input
            label={t("searchLabel")}
            labelHidden
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button
            size="sm"
            variant="secondary"
            type="submit"
            iconOnly
            aria-label={t("searchLabel")}
          >
            <Search size={15} />
          </Button>
        </form>
      </div>

      <div
        style={{
          display: "grid",
          // Intrínseca, sem media query (07 §3): as três colunas encolhem até
          // 260 px e, abaixo disso, empilham sozinhas.
          gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
          gap: "var(--sp-5)",
          alignItems: "start",
        }}
      >
        <Card padded>
          <nav style={{ display: "grid", gap: "var(--sp-4)" }}>
            <div style={{ display: "grid", gap: "var(--sp-1)" }}>
              <FolderButton
                icon={FOLDER_ICONS.inbox}
                label={t("folders.inbox")}
                count={props.counts.inbox}
                active={props.folder === "inbox" && !props.starred}
                onClick={() => go({ pasta: "inbox", estrela: null })}
              />
              <FolderButton
                icon={Star}
                label={t("folders.starred")}
                count={props.counts.starred}
                active={props.starred}
                onClick={() => go({ pasta: "inbox", estrela: "1" })}
              />
              <FolderButton
                icon={FOLDER_ICONS.archive}
                label={t("folders.archive")}
                count={props.counts.archive}
                active={props.folder === "archive" && !props.starred}
                onClick={() => go({ pasta: "archive", estrela: null })}
              />
            </div>

            <div style={{ display: "grid", gap: "var(--sp-2)" }}>
              <strong style={{ fontSize: "13px" }}>{t("labelsTitle")}</strong>
              {props.labels.length === 0 ? (
                <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>{t("noLabels")}</span>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
                  {props.labels.map((label) => (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => go({ marcador: props.labelId === label.id ? null : label.id })}
                      style={{
                        border: "none",
                        background: "none",
                        padding: 0,
                        cursor: "pointer",
                        opacity: props.labelId && props.labelId !== label.id ? 0.5 : 1,
                      }}
                      aria-pressed={props.labelId === label.id}
                    >
                      <StatusTag tone={LABEL_TONES[label.color] ?? "draft"}>{label.name}</StatusTag>
                    </button>
                  ))}
                </div>
              )}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!newLabel.trim() || !props.mailboxId) return;
                  run(
                    () =>
                      props.onCreateLabel({ mailboxId: props.mailboxId!, name: newLabel.trim() }),
                    t("labelCreated"),
                  );
                  setNewLabel("");
                }}
                style={{ display: "flex", gap: "var(--sp-2)", alignItems: "flex-end" }}
              >
                <Input
                  label={t("newLabelLabel")}
                  labelHidden
                  placeholder={t("newLabelPlaceholder")}
                  value={newLabel}
                  maxLength={40}
                  onChange={(event) => setNewLabel(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  type="submit"
                  iconOnly
                  aria-label={t("newLabelLabel")}
                  disabled={pending}
                >
                  <Tag size={15} />
                </Button>
              </form>
            </div>
          </nav>
        </Card>

        <Card padded>
          {props.messages.length === 0 ? (
            <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid" }}>
              {props.messages.map((message) => (
                <MailRow
                  key={message.id}
                  message={message}
                  active={message.id === props.selected?.id}
                  labels={props.labels}
                  dateFormat={dateFormat}
                  pending={pending}
                  onOpen={() => {
                    go({ id: message.id });
                    if (!message.is_read) {
                      run(() => props.onFlags({ messageId: message.id, isRead: true }));
                    }
                  }}
                  onToggleStar={() =>
                    run(() =>
                      props.onFlags({ messageId: message.id, isStarred: !message.is_starred }),
                    )
                  }
                  onToggleRead={() =>
                    run(() => props.onFlags({ messageId: message.id, isRead: !message.is_read }))
                  }
                  onArchive={() =>
                    run(
                      () =>
                        props.onMove({
                          messageId: message.id,
                          folder: message.folder === "archive" ? "inbox" : "archive",
                        }),
                      message.folder === "archive" ? t("unarchived") : t("archived"),
                    )
                  }
                  t={t}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card padded>
          {props.selected ? (
            <MailReader
              message={props.selected}
              labels={props.labels}
              dateFormat={dateFormat}
              pending={pending}
              onToggleLabel={(labelId) =>
                run(() => props.onToggleLabel({ messageId: props.selected!.id, labelId }))
              }
              onCreateTicket={() => run(() => props.onCreateTicket(props.selected!.id))}
              t={t}
            />
          ) : (
            <EmptyState title={t("pickTitle")} description={t("pickBody")} />
          )}
        </Card>
      </div>
    </div>
  );
}

type Translate = ReturnType<typeof useTranslations<"support.mailbox">>;

function FolderButton({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: typeof Inbox;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className="upm-row-button"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        width: "100%",
        minHeight: "40px",
        padding: "var(--sp-2) var(--sp-3)",
        border: "none",
        borderRadius: "var(--r-md)",
        background: active ? "var(--surface2)" : "transparent",
        color: "inherit",
        font: "inherit",
        fontSize: "14px",
        cursor: "pointer",
      }}
    >
      <Icon size={16} aria-hidden="true" />
      <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
      <span
        style={{ fontSize: "12.5px", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}
      >
        {count}
      </span>
    </button>
  );
}

/**
 * Uma linha da lista. As ações aparecem sempre (não só no hover): 04 §2.5 pede
 * ações no hover, mas um alvo que só existe quando há rato não existe em
 * telemóvel nem para quem navega por teclado — ficam visíveis e discretas, com
 * o alvo de 40 px de 07 §5.14.
 */
function MailRow({
  message,
  active,
  labels,
  dateFormat,
  pending,
  onOpen,
  onToggleStar,
  onToggleRead,
  onArchive,
  t,
}: {
  message: MailListItem;
  active: boolean;
  labels: MailLabelRow[];
  dateFormat: Intl.DateTimeFormat;
  pending: boolean;
  onOpen: () => void;
  onToggleStar: () => void;
  onToggleRead: () => void;
  onArchive: () => void;
  t: Translate;
}) {
  const when = message.sent_at ?? message.received_at;
  const own = labels.filter((label) => message.labels.includes(label.id));

  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--sp-2)",
        borderBottom: "1px solid var(--border)",
        background: active ? "var(--surface2)" : "transparent",
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "true" : undefined}
        style={{
          flex: 1,
          minWidth: 0,
          display: "grid",
          gap: "var(--sp-1)",
          padding: "var(--sp-4) var(--sp-2) var(--sp-4) var(--sp-4)",
          border: "none",
          background: "none",
          textAlign: "left",
          font: "inherit",
          color: "inherit",
          cursor: "pointer",
        }}
      >
        <span style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center", minWidth: 0 }}>
          <span
            style={{
              fontSize: "13.5px",
              fontWeight: message.is_read ? 400 : 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {message.from_name || message.from_address}
          </span>
          <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--muted)" }}>
            {dateFormat.format(new Date(when))}
          </span>
        </span>
        <span
          title={message.subject}
          style={{
            fontSize: "14px",
            fontWeight: message.is_read ? 400 : 600,
            color: "var(--text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {message.subject || t("noSubject")}
        </span>
        <span
          style={{
            fontSize: "12.5px",
            color: "var(--muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {message.preview}
        </span>
        {own.length > 0 || message.ticket_id ? (
          <span style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
            {own.map((label) => (
              <StatusTag key={label.id} tone={LABEL_TONES[label.color] ?? "draft"}>
                {label.name}
              </StatusTag>
            ))}
            {message.ticket_id ? (
              <StatusTag tone="ticketProgress">{t("hasTicket")}</StatusTag>
            ) : null}
          </span>
        ) : null}
      </button>

      <span style={{ display: "flex", flexDirection: "column", padding: "var(--sp-2)" }}>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={message.is_starred ? t("unstar") : t("star")}
          aria-pressed={message.is_starred}
          disabled={pending}
          onClick={onToggleStar}
        >
          <Star size={12} fill={message.is_starred ? "currentColor" : "none"} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={message.is_read ? t("markUnread") : t("markRead")}
          disabled={pending}
          onClick={onToggleRead}
        >
          {message.is_read ? <Mail size={12} /> : <MailOpen size={12} />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={message.folder === "archive" ? t("unarchive") : t("archive")}
          disabled={pending}
          onClick={onArchive}
        >
          <Archive size={12} />
        </Button>
      </span>
    </li>
  );
}

function MailReader({
  message,
  labels,
  dateFormat,
  pending,
  onToggleLabel,
  onCreateTicket,
  t,
}: {
  message: MailMessageRow;
  labels: MailLabelRow[];
  dateFormat: Intl.DateTimeFormat;
  pending: boolean;
  onToggleLabel: (labelId: string) => void;
  onCreateTicket: () => void;
  t: Translate;
}) {
  const attachments = Array.isArray(message.attachments)
    ? (message.attachments as { filename?: string; size?: number }[])
    : [];
  const when = message.sent_at ?? message.received_at;

  return (
    <article style={{ display: "grid", gap: "var(--sp-4)" }}>
      <header style={{ display: "grid", gap: "var(--sp-2)" }}>
        <h2 style={{ margin: 0, fontSize: "17px", color: "var(--text)" }}>
          {message.subject || t("noSubject")}
        </h2>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
          {message.from_name ? `${message.from_name} · ` : ""}
          {message.from_address} · {dateFormat.format(new Date(when))}
        </p>
        {message.to_addresses.length > 0 ? (
          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--muted)" }}>
            {t("to")}: {message.to_addresses.join(", ")}
          </p>
        ) : null}
      </header>

      <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
        {labels.map((label) => {
          const on = message.labels.includes(label.id);
          return (
            <button
              key={label.id}
              type="button"
              onClick={() => onToggleLabel(label.id)}
              disabled={pending}
              aria-pressed={on}
              style={{
                border: "none",
                background: "none",
                padding: 0,
                cursor: "pointer",
                opacity: on ? 1 : 0.45,
              }}
            >
              <StatusTag tone={LABEL_TONES[label.color] ?? "draft"}>{label.name}</StatusTag>
            </button>
          );
        })}
      </div>

      {/* Ver a nota de topo: o HTML do e-mail é texto de um estranho. */}
      {message.html ? (
        <iframe
          title={t("bodyTitle")}
          sandbox=""
          srcDoc={message.html}
          style={{
            width: "100%",
            minHeight: "320px",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            background: "var(--surface)",
          }}
        />
      ) : (
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontFamily: "inherit",
            fontSize: "14px",
            lineHeight: 1.55,
            color: "var(--text)",
          }}
        >
          {message.text_body || t("emptyBodyText")}
        </pre>
      )}

      {attachments.length > 0 ? (
        <section style={{ display: "grid", gap: "var(--sp-2)" }}>
          <strong style={{ fontSize: "13px" }}>{t("attachments")}</strong>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: "var(--sp-1)",
            }}
          >
            {attachments.map((file, index) => (
              <li
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--sp-2)",
                  fontSize: "13px",
                  color: "var(--muted)",
                }}
              >
                <Paperclip size={14} aria-hidden="true" />
                {file.filename ?? t("attachment")}
                {/* Os anexos ainda não se descarregam — o worker guarda os
                    metadados, o conteúdo fica no servidor de correio. */}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<LifeBuoy size={15} />}
          disabled={pending}
          onClick={onCreateTicket}
        >
          {message.ticket_id ? t("openTicket") : t("createTicket")}
        </Button>
      </div>
    </article>
  );
}
