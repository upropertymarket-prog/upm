"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Archive,
  ArchiveRestore,
  FileEdit,
  Inbox,
  LifeBuoy,
  Mail,
  MailOpen,
  Paperclip,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Star,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, Input, StatusTag, useToast, type StatusTone } from "@upm/ui";
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
 * **É um cliente de correio, não uma página com listas.** Três colunas de
 * altura total dentro de uma só moldura, cada uma a rolar por si: pastas e
 * marcadores → mensagens → leitura. É o desenho que 04 §2.5 descreve e o que
 * quem trabalha correio o dia inteiro espera encontrar — a primeira versão
 * deste ecrã usava três `Card` soltos numa página que rolava, e lia-se como um
 * formulário, não como uma caixa de entrada.
 *
 * Duas consequências de ser assim, e as duas são deliberadas:
 *
 * - **Não há `PageHeader`.** O cliente de correio é a própria página; um
 *   cabeçalho por cima roubava altura à única coisa que interessa e empurrava a
 *   leitura para fora do ecrã. A sidebar e a topbar já dizem onde estamos.
 * - **O shell entra em `fill`**, como nas Mensagens: sem uma altura definida de
 *   onde herdar, as colunas ficam do tamanho do texto.
 *
 * ## O corpo do e-mail vive dentro de um iframe com `sandbox`
 *
 * 02 §4.3 é explícito — "e-mails recebidos renderizados em iframe sandbox" — e
 * é a única defesa que não depende de acertarmos numa lista de etiquetas
 * permitidas. O HTML de um e-mail é texto de um estranho: pode trazer
 * `<script>`, um `<form>` para um site de phishing, CSS que cobre a página ou
 * um `<a target="_top">` que navega a aplicação inteira. Com `sandbox` vazio não
 * corre JavaScript, não submete formulários, não navega o pai e não herda a
 * nossa origem — logo não alcança a sessão de quem está a ler.
 *
 * `srcDoc` e não `src`: o conteúdo vem connosco, não de um pedido ao servidor do
 * remetente — um `src` remoto confirmaria a leitura a quem enviou, que é o que o
 * bloqueio de imagens externas existe para evitar.
 *
 * ## Os três botões que estão desativados
 *
 * "Novo e-mail", "Responder" e "Encaminhar" são o composer, que é **P10-05**.
 * Ficam no sítio, desativados e com o motivo escrito em `title` — e não
 * escondidos: o ecrã é o mesmo quando o composer chegar, e quem o revê agora vê
 * onde as peças vão encaixar. Um botão ativo que não faz nada é que seria uma
 * promessa partida.
 */

const LABEL_TONES: Record<string, StatusTone> = {
  accent: "draft",
  success: "active",
  warning: "pending",
  danger: "rejected",
  info: "ticketProgress",
  muted: "archived",
};

type FolderKey = MailFolder | "starred";

const FOLDERS: { key: FolderKey; icon: typeof Inbox }[] = [
  { key: "inbox", icon: Inbox },
  { key: "sent", icon: Send },
  { key: "drafts", icon: FileEdit },
  { key: "archive", icon: Archive },
  { key: "starred", icon: Star },
];

export type MailCounts = Record<MailFolder, number> & { unread: number; starred: number };

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
  counts: MailCounts;
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
  onSync: () => Promise<MailActionResult>;
};

export function MailboxView(props: MailboxViewProps) {
  const t = useTranslations("support.mailbox");
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState(props.search);
  const [newLabel, setNewLabel] = useState("");
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [pending, startTransition] = useTransition();

  const dateFormat = new Intl.DateTimeFormat(props.locale === "en" ? "en-IE" : "pt-PT", {
    day: "2-digit",
    month: "2-digit",
  });
  const fullDateFormat = new Intl.DateTimeFormat(props.locale === "en" ? "en-IE" : "pt-PT", {
    dateStyle: "long",
    timeStyle: "short",
  });

  function go(next: Record<string, string | null>) {
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

  /** Toda a escrita passa por aqui: o mesmo erro, o mesmo refresh. */
  function run(action: () => Promise<MailActionResult>, success?: string) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      const message = success ?? result.notice;
      if (message) toast(message, "success");
      router.refresh();
    });
  }

  const activeFolder: FolderKey = props.starred ? "starred" : props.folder;
  const mailbox = props.mailboxes.find((box) => box.id === props.mailboxId) ?? null;

  if (props.mailboxes.length === 0) {
    return (
      <div className="upm-mail upm-mail--empty">
        <EmptyState title={t("noMailboxTitle")} description={t("noMailboxBody")} />
      </div>
    );
  }

  return (
    <div className="upm-mail">
      {/* ---------------------------------------------------------------- */}
      {/* Coluna 1 — onde estou                                             */}
      {/* ---------------------------------------------------------------- */}
      <aside className="upm-mail__rail">
        <div className="upm-mail__rail-top">
          <Button disabled title={t("composerSoon")} style={{ width: "100%" }}>
            {t("compose")}
          </Button>
        </div>

        <nav className="upm-mail__folders" aria-label={t("foldersLabel")}>
          {FOLDERS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className="upm-mail__folder"
              aria-current={activeFolder === key ? "true" : undefined}
              onClick={() =>
                key === "starred"
                  ? go({ pasta: "inbox", estrela: "1" })
                  : go({ pasta: key, estrela: null })
              }
            >
              <Icon size={16} aria-hidden="true" />
              <span className="upm-mail__folder-label">{t(`folders.${key}`)}</span>
              <span className="upm-mail__folder-count">
                {key === "starred" ? props.counts.starred : props.counts[key]}
              </span>
            </button>
          ))}
        </nav>

        <div className="upm-mail__labels">
          <div className="upm-mail__labels-head">
            <span>{t("labelsTitle")}</span>
            <Button
              size="sm"
              variant="ghost"
              iconOnly
              aria-label={t("newLabelLabel")}
              aria-expanded={creatingLabel}
              onClick={() => setCreatingLabel((open) => !open)}
            >
              <Plus size={14} />
            </Button>
          </div>

          {props.labels.length === 0 && !creatingLabel ? (
            <span className="upm-mail__muted">{t("noLabels")}</span>
          ) : null}

          {props.labels.map((label) => (
            <button
              key={label.id}
              type="button"
              className="upm-mail__label"
              aria-pressed={props.labelId === label.id}
              onClick={() => go({ marcador: props.labelId === label.id ? null : label.id })}
            >
              <StatusTag tone={LABEL_TONES[label.color] ?? "draft"}>{label.name}</StatusTag>
            </button>
          ))}

          {creatingLabel ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!newLabel.trim() || !props.mailboxId) return;
                run(
                  () => props.onCreateLabel({ mailboxId: props.mailboxId!, name: newLabel.trim() }),
                  t("labelCreated"),
                );
                setNewLabel("");
                setCreatingLabel(false);
              }}
            >
              <Input
                label={t("newLabelLabel")}
                labelHidden
                placeholder={t("newLabelPlaceholder")}
                value={newLabel}
                maxLength={40}
                autoFocus
                onChange={(event) => setNewLabel(event.target.value)}
              />
            </form>
          ) : null}
        </div>

        <div className="upm-mail__rail-bottom">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<RefreshCw size={14} />}
            disabled={pending}
            onClick={() => run(props.onSync)}
            style={{ width: "100%" }}
          >
            {t("sync")}
          </Button>

          {/* O seletor de caixa fica em baixo, como o seletor de conta de
              qualquer cliente de correio: escolhe-se uma vez por turno, não a
              cada mensagem. */}
          <label className="upm-mail__account">
            <span className="upm-mail__muted">{t("mailboxLabel")}</span>
            <select
              className="upm-mail__account-select"
              value={props.mailboxId ?? ""}
              onChange={(event) => go({ caixa: event.target.value, id: null, marcador: null })}
            >
              {props.mailboxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.displayName || box.address}
                </option>
              ))}
            </select>
            <span className="upm-mail__account-address">{mailbox?.address}</span>
          </label>
        </div>
      </aside>

      {/* ---------------------------------------------------------------- */}
      {/* Coluna 2 — o que há                                               */}
      {/* ---------------------------------------------------------------- */}
      <section className="upm-mail__list" aria-label={t("listLabel")}>
        <div className="upm-mail__list-head">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              go({ q: query || null });
            }}
          >
            <Input
              label={t("searchLabel")}
              labelHidden
              placeholder={t("searchPlaceholder")}
              leadingIcon={<Search size={15} />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
          <span className="upm-mail__muted">
            {t("messageCount", { count: props.messages.length })}
          </span>
        </div>

        <div className="upm-mail__list-body">
          {props.messages.length === 0 ? (
            <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />
          ) : (
            <ul className="upm-mail__rows">
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
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Coluna 3 — o que diz                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="upm-mail__reader" aria-label={t("readerLabel")}>
        {props.selected ? (
          <MailReader
            message={props.selected}
            labels={props.labels}
            dateFormat={fullDateFormat}
            pending={pending}
            onToggleStar={() =>
              run(() =>
                props.onFlags({
                  messageId: props.selected!.id,
                  isStarred: !props.selected!.is_starred,
                }),
              )
            }
            onArchive={() =>
              run(
                () =>
                  props.onMove({
                    messageId: props.selected!.id,
                    folder: props.selected!.folder === "archive" ? "inbox" : "archive",
                  }),
                props.selected!.folder === "archive" ? t("unarchived") : t("archived"),
              )
            }
            onToggleLabel={(labelId) =>
              run(() => props.onToggleLabel({ messageId: props.selected!.id, labelId }))
            }
            onCreateTicket={() => run(() => props.onCreateTicket(props.selected!.id))}
            t={t}
          />
        ) : (
          <div className="upm-mail__reader-empty">
            <EmptyState title={t("pickTitle")} description={t("pickBody")} />
          </div>
        )}
      </section>
    </div>
  );
}

type Translate = ReturnType<typeof useTranslations<"support.mailbox">>;

/** As iniciais de quem escreveu, como em qualquer cliente de correio. */
function Avatar({ name, email }: { name: string; email: string }) {
  const source = name.trim() || email.trim() || "?";
  const letters = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span className="upm-mail__avatar" aria-hidden="true">
      {letters || "?"}
    </span>
  );
}

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
      className="upm-mail__row"
      data-active={active ? "true" : "false"}
      data-unread={message.is_read ? "false" : "true"}
    >
      <button type="button" className="upm-mail__row-main" onClick={onOpen}>
        <Avatar name={message.from_name} email={message.from_address} />
        <span className="upm-mail__row-text">
          <span className="upm-mail__row-top">
            <span className="upm-mail__row-from">{message.from_name || message.from_address}</span>
            <span className="upm-mail__row-date">{dateFormat.format(new Date(when))}</span>
          </span>
          <span className="upm-mail__row-subject" title={message.subject}>
            {message.subject || t("noSubject")}
          </span>
          <span className="upm-mail__row-preview">{message.preview}</span>
          {own.length > 0 || message.ticket_id ? (
            <span className="upm-mail__row-tags">
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
        </span>
        {message.has_attachments ? (
          <Paperclip size={12} aria-hidden="true" className="upm-mail__row-clip" />
        ) : null}
      </button>

      {/* As ações aparecem no hover e no foco — e **ficam** visíveis quando a
          mensagem está aberta ou tem estrela, para não desaparecerem de quem
          navega por teclado ou toca no ecrã (07 §5.14). */}
      <span className="upm-mail__row-actions">
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
          {message.folder === "archive" ? <ArchiveRestore size={12} /> : <Archive size={12} />}
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
  onToggleStar,
  onArchive,
  onToggleLabel,
  onCreateTicket,
  t,
}: {
  message: MailMessageRow;
  labels: MailLabelRow[];
  dateFormat: Intl.DateTimeFormat;
  pending: boolean;
  onToggleStar: () => void;
  onArchive: () => void;
  onToggleLabel: (labelId: string) => void;
  onCreateTicket: () => void;
  t: Translate;
}) {
  const attachments = Array.isArray(message.attachments)
    ? (message.attachments as { filename?: string; size?: number }[])
    : [];
  const when = message.sent_at ?? message.received_at;

  return (
    <>
      <header className="upm-mail__reader-head">
        <h2 className="upm-mail__reader-subject">{message.subject || t("noSubject")}</h2>
        <span className="upm-mail__reader-actions">
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            aria-label={message.is_starred ? t("unstar") : t("star")}
            aria-pressed={message.is_starred}
            disabled={pending}
            onClick={onToggleStar}
          >
            <Star size={15} fill={message.is_starred ? "currentColor" : "none"} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            aria-label={message.folder === "archive" ? t("unarchive") : t("archive")}
            disabled={pending}
            onClick={onArchive}
          >
            {message.folder === "archive" ? <ArchiveRestore size={15} /> : <Archive size={15} />}
          </Button>
        </span>
      </header>

      <div className="upm-mail__reader-meta">
        <Avatar name={message.from_name} email={message.from_address} />
        <div className="upm-mail__reader-who">
          <span className="upm-mail__reader-sender">
            {message.from_name || message.from_address}
          </span>
          <span className="upm-mail__muted">
            &lt;{message.from_address}&gt;
            {message.to_addresses.length > 0
              ? ` · ${t("to")}: ${message.to_addresses.join(", ")}`
              : ""}
          </span>
          <span className="upm-mail__muted">{dateFormat.format(new Date(when))}</span>
        </div>
        <span className="upm-mail__reader-labels">
          {labels.map((label) => {
            const on = message.labels.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                className="upm-mail__label"
                data-off={on ? "false" : "true"}
                aria-pressed={on}
                disabled={pending}
                onClick={() => onToggleLabel(label.id)}
              >
                <StatusTag tone={LABEL_TONES[label.color] ?? "draft"}>{label.name}</StatusTag>
              </button>
            );
          })}
        </span>
      </div>

      <div className="upm-mail__reader-body">
        {/* Ver a nota de topo: o HTML do e-mail é texto de um estranho. */}
        {message.html ? (
          <iframe title={t("bodyTitle")} sandbox="" srcDoc={message.html} />
        ) : (
          <pre>{message.text_body || t("emptyBodyText")}</pre>
        )}

        {attachments.length > 0 ? (
          <section className="upm-mail__attachments">
            <strong>{t("attachments")}</strong>
            <ul>
              {attachments.map((file, index) => (
                <li key={index}>
                  <Paperclip size={14} aria-hidden="true" />
                  {file.filename ?? t("attachment")}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <footer className="upm-mail__reader-foot">
        <Button disabled leadingIcon={<Reply size={15} />} title={t("composerSoon")}>
          {t("reply")}
        </Button>
        <Button variant="secondary" disabled title={t("composerSoon")}>
          {t("forward")}
        </Button>
        <Button
          variant="secondary"
          leadingIcon={<LifeBuoy size={15} />}
          disabled={pending}
          onClick={onCreateTicket}
        >
          {message.ticket_id ? t("openTicket") : t("createTicket")}
        </Button>
      </footer>
    </>
  );
}
