"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  CloudUpload,
  Download,
  FileEdit,
  Forward,
  Inbox,
  LifeBuoy,
  Mail,
  MailOpen,
  MailX,
  Paperclip,
  Plus,
  Printer,
  RefreshCw,
  Reply,
  Search,
  Send,
  Star,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, Input, StatusTag, useToast, type StatusTone } from "@upm/ui";
import type {
  MailAttachment,
  MailFolder,
  MailLabelRow,
  MailListItem,
  MailMessageRow,
  MailboxOption,
} from "@upm/db/mail";
import { mailAttachmentsOf } from "@upm/db/mail";
import { MAIL_ATTACHMENT_PRINTABLE } from "@upm/db/mail-attachments";

import type { MailActionResult } from "./actions";
import { Composer, type ComposerDraft } from "./Composer";

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
 * ## Os anexos, e os botões que já não estão desativados
 *
 * As três ações do anexo — Transferir, Imprimir, Guardar na Cloud — nasceram
 * desativadas em P10-04, com o motivo em `title`, porque o worker guardava só o
 * nome, o tipo e o tamanho. Foi D66, e está paga: os bytes vivem no bucket
 * `mail-attachments` e as três fazem o que dizem. Ver `AttachmentRow`, que
 * também diz o que acontece a um anexo que não tem bytes — e eles continuam a
 * existir, por tipo recusado, por tamanho ou por prazo de reteção.
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
  /** A assinatura da caixa escolhida, já com as variáveis resolvidas (05 §1.8). */
  signature: string;
  onSaveDraft: (input: Record<string, unknown>) => Promise<MailActionResult & { draftId?: string }>;
  onSend: (input: Record<string, unknown>) => Promise<MailActionResult>;
  onDiscardDraft: (draftId: string) => Promise<MailActionResult>;
  /** O URL assinado de um anexo, para transferir ou para imprimir (D66). */
  onAttachmentLink: (input: {
    messageId: string;
    index: number;
    mode: "download" | "view";
  }) => Promise<MailActionResult & { url?: string; filename?: string }>;
  onAttachmentToCloud: (input: { messageId: string; index: number }) => Promise<MailActionResult>;
};

export function MailboxView(props: MailboxViewProps) {
  const t = useTranslations("support.mailbox");
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState(props.search);
  const [newLabel, setNewLabel] = useState("");
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [pending, startTransition] = useTransition();
  /**
   * `null` = janela fechada. Escrever, responder e encaminhar abrem a mesma
   * janela com conteúdo diferente — são a mesma tarefa com pontos de partida
   * diferentes, e dois componentes divergiriam à primeira alteração.
   */
  const [composer, setComposer] = useState<ComposerDraft | null>(null);

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
        <EmptyState
          icon={<EmptyIcon icon={MailX} />}
          title={t("noMailboxTitle")}
          description={t("noMailboxBody")}
        />
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
          <Button style={{ width: "100%" }} onClick={() => setComposer({})}>
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
            onReply={() => setComposer(replyDraft(props.selected!, t))}
            onForward={() => setComposer(forwardDraft(props.selected!, t))}
            onAttachmentLink={props.onAttachmentLink}
            onAttachmentToCloud={(index) =>
              run(() => props.onAttachmentToCloud({ messageId: props.selected!.id, index }))
            }
            onError={(message) => toast(message, "error")}
            t={t}
          />
        ) : (
          <div className="upm-mail__reader-empty">
            <EmptyState
              icon={<EmptyIcon icon={Mail} />}
              title={t("pickTitle")}
              description={t("pickBody")}
            />
          </div>
        )}
      </section>

      {props.mailboxId ? (
        <Composer
          open={composer !== null}
          mailboxes={props.mailboxes}
          mailboxId={props.mailboxId}
          signature={props.signature}
          initial={composer ?? undefined}
          onClose={() => {
            setComposer(null);
            router.refresh();
          }}
          onSave={props.onSaveDraft}
          onSend={props.onSend}
          onDiscard={props.onDiscardDraft}
        />
      ) : null}
    </div>
  );
}

type Translate = ReturnType<typeof useTranslations<"support.mailbox">>;

/**
 * Responder e encaminhar são a mesma janela com pontos de partida diferentes.
 *
 * O corpo citado vai **em texto**, dentro de um `blockquote`, e não o HTML
 * original: reenviar o HTML de outra pessoa dentro do nosso traz-lhe os estilos
 * e, com eles, o retângulo branco que esta revisão foi corrigir. O prefixo do
 * assunto só se acrescenta uma vez — "Re: Re: Re:" é ruído, não histórico.
 */
function quoted(message: MailMessageRow, t: Translate): string {
  const who = message.from_name || message.from_address;
  const body = (message.text_body ?? "")
    .split("\n")
    .map((line) => line.trim())
    .join("<br>");
  return `<p><br></p><p>${t("quotedIntro", { name: who })}</p><blockquote>${body}</blockquote>`;
}

function replyDraft(message: MailMessageRow, t: Translate): ComposerDraft {
  const subject = /^re:/i.test(message.subject)
    ? message.subject
    : `Re: ${message.subject || t("noSubject")}`;
  return {
    to: [message.from_address].filter(Boolean),
    subject,
    html: quoted(message, t),
    inReplyTo: message.message_id,
  };
}

function forwardDraft(message: MailMessageRow, t: Translate): ComposerDraft {
  const subject = /^fw(d)?:/i.test(message.subject)
    ? message.subject
    : `Fwd: ${message.subject || t("noSubject")}`;
  return { to: [], subject, html: quoted(message, t) };
}

/**
 * O corpo do e-mail, vestido com o tema da aplicação
 * =========================================================================
 * O HTML chega com as cores de quem o escreveu — quase sempre texto escuro
 * sobre branco. Mostrado tal e qual, o tema escuro ganhava um retângulo branco
 * no meio da aplicação; mostrado sem isolamento, ganhava um problema de
 * segurança. As duas coisas resolvem-se ao mesmo tempo: o conteúdo continua
 * dentro de um `iframe` com `sandbox` (02 §4.3) e **a folha de estilos que o
 * acompanha é nossa**, construída com os tokens resolvidos do tema em que a
 * aplicação está nesse momento.
 *
 * Os tokens leem-se do próprio elemento com `getComputedStyle` — e não de
 * `document.documentElement` — porque o tema pode estar declarado num
 * antepassado qualquer: é o que acontece nas storyboards, onde cada moldura tem
 * o seu `data-theme`. Um `MutationObserver` reage à troca de tema sem que seja
 * preciso recarregar a mensagem.
 *
 * **O que a folha força, e o que deixa em paz.** Força o fundo a transparente,
 * o texto à cor do tema e as molduras às nossas — é o que faz a assinatura de
 * quem escreveu ficar legível no escuro. Deixa em paz as imagens: um logótipo é
 * do remetente e não nosso, e recolori-lo seria mentir sobre o que ele enviou.
 *
 * `sandbox` sem `allow-scripts` nem `allow-same-origin`: não corre JavaScript,
 * não submete formulários e não alcança a nossa sessão. `allow-popups` existe
 * para uma ligação do e-mail poder abrir **noutro separador** — sem isso, um
 * clique num link não fazia nada e quem está no Suporte copiava o URL à mão.
 */
function MailBody({ html, text, t }: { html: string | null; text: string | null; t: Translate }) {
  const host = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const read = () => {
      const node = host.current;
      if (!node) return;
      const css = getComputedStyle(node);
      const token = (name: string) => css.getPropertyValue(name).trim();
      const surface = token("--surface");
      setTheme({
        text: token("--text"),
        muted: token("--muted"),
        accent: token("--accent"),
        border: token("--border"),
        surface,
        font: token("--font-sans"),
        // Do **tom da superfície**, e não da árvore do DOM: o atributo do tema
        // tanto pode estar no `<html>` da aplicação como no invólucro de uma
        // storyboard, e procurá-lo por `closest()` falhava num dos dois. A cor
        // que já temos responde à pergunta sem depender de onde está escrita.
        scheme: isDark(surface) ? "dark" : "light",
      });
    };

    read();

    // O alternador de tema muda um atributo acima deste componente; sem o
    // observador, a mensagem já aberta ficava com as cores do tema anterior.
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  if (!html) {
    return (
      <div ref={host} className="upm-mail__plain">
        <pre>{text || t("emptyBodyText")}</pre>
      </div>
    );
  }

  const srcDoc = theme
    ? `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
:root{color-scheme:${theme.scheme};}
html,body{margin:0;padding:0;background:${theme.surface}!important;color:${theme.text}!important;font:14px/1.6 ${theme.font || "system-ui, sans-serif"};overflow-wrap:anywhere;-webkit-font-smoothing:antialiased;}
*{background-color:transparent!important;border-color:${theme.border}!important;}
*:not(a):not(img){color:inherit!important;}
a{color:${theme.accent}!important;text-decoration:underline;}
img{max-width:100%;height:auto;}
table{border-collapse:collapse;max-width:100%;}
hr{border:0;border-top:1px solid ${theme.border};}
blockquote{margin:0;padding-left:12px;border-left:3px solid ${theme.border};color:${theme.muted}!important;}
</style></head><body>${html}</body></html>`
    : "";

  return (
    <div ref={host} className="upm-mail__frame">
      <iframe
        title={t("bodyTitle")}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={srcDoc}
      />
    </div>
  );
}

/**
 * O ícone dos estados vazios: num disco, discreto, como na referência. Não é
 * decoração — um painel só com texto lê-se como um erro, e o envelope diz em
 * meio segundo que aquele espaço é de correio e está à espera de uma escolha.
 */
function EmptyIcon({ icon: Icon }: { icon: typeof Mail }) {
  return (
    <span className="upm-mail__empty-icon">
      <Icon size={22} />
    </span>
  );
}

/**
 * O tema é escuro? Decidido pela luminância da superfície, com a fórmula
 * habitual (ITU-R BT.601). Serve só para dizer ao documento do e-mail que
 * `color-scheme` usar — é o que faz o browser desenhar as barras de rolamento e
 * os campos nativos do lado certo em vez de os deixar brancos.
 */
function isDark(color: string): boolean {
  const parts = color.match(/\d+(\.\d+)?/g);
  if (!parts || parts.length < 3) return false;
  const [r, g, b] = parts.map(Number) as [number, number, number];
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

/**
 * O tamanho do ficheiro como as pessoas o leem. Base 1024, e casa decimal só a
 * partir dos MB: "1,2 MB" é informação, "1,2 KB" é ruído.
 */
export function fileSize(bytes: number | undefined): string {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
}

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

/**
 * A linha de um anexo, com as três ações da referência (D66)
 * =========================================================================
 * As três estavam no ecrã desde P10-04, desativadas, porque o worker guardava
 * só o cartão de visita do anexo. Com os bytes no bucket `mail-attachments`,
 * passam a fazer o que dizem — e cada uma por um caminho diferente, pela razão
 * que está escrita em cada uma.
 *
 * **Um anexo sem bytes continua a aparecer.** Recusado por tipo, por tamanho,
 * por ser o 11.º da mensagem, ou já expirado pelos 180 dias: a linha fica, com
 * a razão em `title`, e as três ações desativadas. Esconder o anexo era pior do
 * que isto — quem lê deixava de saber que o cliente tinha anexado alguma coisa.
 */
function AttachmentRow({
  file,
  pending,
  onLink,
  onSaveToCloud,
  onError,
  t,
}: {
  file: MailAttachment;
  pending: boolean;
  onLink: (
    mode: "download" | "view",
  ) => Promise<MailActionResult & { url?: string; filename?: string }>;
  onSaveToCloud: () => void;
  onError: (message: string) => void;
  t: Translate;
}) {
  const [busy, setBusy] = useState(false);

  const stored = Boolean(file.path);
  const printable = stored && MAIL_ATTACHMENT_PRINTABLE.includes(file.contentType);
  const saved = Boolean(file.cloudFileId);
  const reason = stored ? undefined : t(`attachmentSkipped.${file.skipped ?? "error"}`);

  /**
   * Transferir: o URL assinado já leva o `Content-Disposition` com o nome
   * original, por isso basta navegar para ele. `<a download>` com um URL de
   * outra origem é ignorado pelos browsers — o cabeçalho é que decide, e é por
   * isso que a escolha está do lado do servidor e não num atributo.
   */
  async function download() {
    setBusy(true);
    try {
      const result = await onLink("download");
      if (result.error || !result.url) {
        onError(result.error ?? t("attachmentFailed"));
        return;
      }
      window.location.assign(result.url);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Imprimir: os bytes vêm para cá e abrem numa janela **nossa**.
   *
   * Não é um `window.open(url)` seguido de `print()`: o URL assinado é de outra
   * origem (o Storage), e o browser não deixa a nossa página chamar `print()`
   * dentro dela. Um `blob:` criado aqui herda a nossa origem — e com isso a
   * janela volta a ser nossa e o `print()` é chamável. É também o que evita um
   * segundo pedido ao Storage para desenhar o que já temos em mão.
   */
  async function print() {
    setBusy(true);
    let blobUrl: string | null = null;
    try {
      const result = await onLink("view");
      if (result.error || !result.url) {
        onError(result.error ?? t("attachmentFailed"));
        return;
      }

      const response = await fetch(result.url);
      if (!response.ok) {
        onError(t("attachmentFailed"));
        return;
      }
      blobUrl = URL.createObjectURL(await response.blob());

      const frame = document.createElement("iframe");
      frame.hidden = true;
      frame.src = blobUrl;
      frame.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      };
      document.body.append(frame);

      // A janela de impressão é modal e síncrona, mas o utilizador pode
      // cancelá-la; a limpeza é por tempo porque não há evento que diga "a
      // caixa de diálogo fechou". Um minuto é folgado de propósito: tirar o
      // iframe com a caixa aberta cancelava a impressão.
      window.setTimeout(() => {
        frame.remove();
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      }, 60_000);
    } catch {
      onError(t("attachmentFailed"));
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="upm-mail__attachment" data-stored={stored ? "true" : "false"}>
      <span className="upm-mail__attachment-icon" aria-hidden="true">
        <Paperclip size={15} />
      </span>
      <span className="upm-mail__attachment-name" title={reason ?? file.filename}>
        {file.filename || t("attachment")}
      </span>
      {reason ? <span className="upm-mail__attachment-note">{reason}</span> : null}
      <span className="upm-mail__attachment-size">{fileSize(file.size)}</span>

      <span className="upm-mail__attachment-actions" data-saved={saved ? "true" : "false"}>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={t("download")}
          title={reason ?? t("download")}
          disabled={!stored || busy}
          onClick={download}
        >
          <Download size={14} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={t("print")}
          title={reason ?? (printable ? t("print") : t("printUnsupported"))}
          disabled={!printable || busy}
          onClick={print}
        >
          <Printer size={14} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={saved ? t("savedToCloud") : t("saveToCloud")}
          title={reason ?? (saved ? t("savedToCloud") : t("saveToCloud"))}
          aria-pressed={saved}
          disabled={!stored || saved || busy || pending}
          onClick={onSaveToCloud}
        >
          {/* Já guardado: o visto, e não uma segunda nuvem — o ícone tem de
              dizer "está feito" e não "faz outra vez". */}
          {saved ? <Check size={14} /> : <CloudUpload size={14} />}
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
  onReply,
  onForward,
  onAttachmentLink,
  onAttachmentToCloud,
  onError,
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
  onReply: () => void;
  onForward: () => void;
  onAttachmentLink: MailboxViewProps["onAttachmentLink"];
  onAttachmentToCloud: (index: number) => void;
  onError: (message: string) => void;
  t: Translate;
}) {
  const attachments = mailAttachmentsOf(message);
  const when = message.sent_at ?? message.received_at;

  return (
    <>
      <header className="upm-mail__reader-head">
        <h2 className="upm-mail__reader-subject">{message.subject || t("noSubject")}</h2>
        {/* Horizontais e esbatidas até o rato ou o foco entrarem no leitor —
            como na referência. A estrela foge à regra quando está ligada: um
            estado que não se vê não é um estado. */}
        <span className="upm-mail__reader-actions" data-pinned={message.is_starred}>
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
          <Button size="sm" variant="ghost" iconOnly aria-label={t("reply")} onClick={onReply}>
            <Reply size={15} />
          </Button>
          <Button size="sm" variant="ghost" iconOnly aria-label={t("forward")} onClick={onForward}>
            <Forward size={15} />
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
        <MailBody html={message.html} text={message.text_body} t={t} />

        {attachments.length > 0 ? (
          <section className="upm-mail__attachments">
            <strong>{t("attachmentsCount", { count: attachments.length })}</strong>
            <ul>
              {attachments.map((file, index) => (
                <AttachmentRow
                  key={index}
                  file={file}
                  pending={pending}
                  onLink={(mode) => onAttachmentLink({ messageId: message.id, index, mode })}
                  onSaveToCloud={() => onAttachmentToCloud(index)}
                  onError={onError}
                  t={t}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <footer className="upm-mail__reader-foot">
        <Button leadingIcon={<Reply size={15} />} onClick={onReply}>
          {t("reply")}
        </Button>
        <Button variant="secondary" leadingIcon={<Forward size={15} />} onClick={onForward}>
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
