"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, resolveLocale } from "@upm/config";
import { MapPin, Paperclip, Search, Send } from "lucide-react";
import { Badge, Button, EmptyState, Input, useToast } from "@upm/ui";
import { formatBytes } from "@upm/db/cloud";

import {
  formatRelative,
  formatTime,
  type ConversationDetail,
  type ConversationSummary,
} from "../interaction/interactionTypes";

import "./messages-screen.css";

export type MessagesScreenProps = {
  conversations: ConversationSummary[];
  /** A conversa aberta, já com as mensagens. `null` = ainda nenhuma escolhida. */
  active: ConversationDetail | null;
  /** Server Actions injetadas por prop — ver `interactionTypes.ts`. */
  onSend: (input: { conversation_id: string; body: string }) => Promise<{ error?: string }>;
  onShareAddress: (propertyId: string, buyerId: string) => Promise<{ error?: string }>;
  /** Anexos (07 §19.6 · D28): enviar, abrir e guardar na Cloud. */
  onSendAttachment?: (formData: FormData) => Promise<{ error?: string }>;
  onOpenAttachment?: (
    messageId: string,
    path: string,
    action?: "view" | "download",
  ) => Promise<{ url?: string; error?: string }>;
  onSaveAttachmentToCloud?: (messageId: string, path: string) => Promise<{ error?: string }>;
  /** Navegação para outra conversa. A página decide se é rota ou estado. */
  onSelect: (conversationId: string) => void;
  /** Chamada quando chega uma mensagem nova por realtime (02 §10). */
  onRefresh?: () => void;
};

/**
 * Mensagens (P5-01) — 04 §8.3 "Mensagens" e §8.4 (o comprador tem o mesmo
 * ecrã). Lista de conversas com não lidas à esquerda, chat à direita, como a
 * referência (`App Proprietario.dc.html`, bloco `sChat`).
 *
 * Sem alturas fixas: os dois painéis ocupam o que sobra do shell — a rota e a
 * storyboard pedem-lhe `fill` — e quem rola é o interior de cada um, não a
 * página. Foi a lição das cinco alturas em pixels que tiveram de ser limpas do
 * shell na Fase 4 (08 §9, adenda 2). A grelha vive em `messages-screen.css`:
 * precisa de um ponto de corte, e isso não cabe num estilo em linha.
 */
export function MessagesScreen({
  conversations,
  active,
  onSend,
  onShareAddress,
  onSendAttachment,
  onOpenAttachment,
  onSaveAttachmentToCloud,
  onSelect,
  onRefresh,
}: MessagesScreenProps) {
  const t = useTranslations("messages");
  const intlLocale = INTL_LOCALE[resolveLocale(useLocale())];
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const listEnd = useRef<HTMLDivElement>(null);
  const filePicker = useRef<HTMLInputElement>(null);

  // O chat abre sempre no fim, como qualquer aplicação de mensagens.
  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [active?.id, active?.messages.length]);

  const filtered = query.trim()
    ? conversations.filter((item) =>
        `${item.other.name} ${item.propertyTitle}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : conversations;

  const unreadTotal = conversations.filter((item) => item.unread > 0).length;

  function send() {
    const body = draft.trim();
    if (!body || !active) return;
    startTransition(async () => {
      const result = await onSend({ conversation_id: active.id, body });
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setDraft("");
      onRefresh?.();
    });
  }

  /**
   * Escolher um ficheiro envia-o (07 §19.6): não há rascunho de anexo à espera
   * do botão de enviar, que é onde um anexo se perde com um refresh.
   */
  function attach(file: File | undefined) {
    if (!file || !active || !onSendAttachment) return;
    const formData = new FormData();
    formData.set("conversationId", active.id);
    formData.set("file", file);
    startTransition(async () => {
      const result = await onSendAttachment(formData);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      onRefresh?.();
    });
  }

  function openAttachment(messageId: string, path: string) {
    if (!onOpenAttachment) return;
    startTransition(async () => {
      const result = await onOpenAttachment(messageId, path, "download");
      if (result.error || !result.url) {
        toast(result.error ?? t("attachmentFailed"), "error");
        return;
      }
      // Ligação assinada de 60 s: abre-se já, e não se guarda em nenhum sítio.
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  function saveToCloud(messageId: string, path: string) {
    if (!onSaveAttachmentToCloud) return;
    startTransition(async () => {
      const result = await onSaveAttachmentToCloud(messageId, path);
      toast(result.error ?? t("savedToCloud"), result.error ? "error" : "success");
    });
  }

  function shareAddress() {
    if (!active) return;
    startTransition(async () => {
      const result = await onShareAddress(active.propertyId, active.buyerId);
      toast(
        result.error ?? t("addressSharedToast", { name: active.other.name }),
        result.error ? "error" : "success",
      );
      onRefresh?.();
    });
  }

  return (
    <div className="upm-messages">
      <section aria-label={t("listLabel")} className="upm-messages__list">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
          <h2 style={{ margin: 0, fontSize: "var(--fs-subtitle-lg)" }}>{t("listTitle")}</h2>
          {unreadTotal > 0 ? (
            <Badge srLabel={t("unreadTotal", { count: unreadTotal })}>{unreadTotal}</Badge>
          ) : null}
        </div>
        <Input
          label={t("search")}
          labelHidden
          placeholder={t("search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          leadingIcon={<Search size={14} aria-hidden="true" />}
        />
        <ul className="upm-messages__items">
          {filtered.map((item) => {
            const open = item.id === active?.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={open ? "true" : undefined}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    display: "grid",
                    gap: "var(--sp-1)",
                    padding: "var(--sp-5)",
                    border: "1px solid var(--border)",
                    borderLeft: `3px solid ${open ? "var(--accent)" : "transparent"}`,
                    borderRadius: "var(--r-xl)",
                    background: open ? "var(--surface2)" : "transparent",
                    cursor: "pointer",
                    color: "var(--text)",
                    minWidth: 0,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-3)" }}>
                    <strong
                      style={{
                        fontSize: "var(--fs-body-lg)",
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.other.name}
                    </strong>
                    <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                      {item.lastMessageAt ? formatRelative(item.lastMessageAt, intlLocale) : ""}
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: "var(--fs-body)",
                      fontWeight: "var(--fw-medium)",
                      color: "var(--accent)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.propertyTitle}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: "var(--fs-body)",
                        color: "var(--muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.lastMessage || t("noMessages")}
                    </span>
                    {item.unread > 0 ? (
                      <Badge srLabel={t("unreadInConversation", { count: item.unread })}>
                        {item.unread}
                      </Badge>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 ? (
          <EmptyState
            title={conversations.length === 0 ? t("emptyTitle") : t("noResultsTitle")}
            description={conversations.length === 0 ? t("emptyBody") : t("noResultsBody")}
          />
        ) : null}
      </section>

      <section aria-label={t("threadLabel")} className="upm-messages__thread">
        {active ? (
          <>
            <header
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-5)",
                padding: "var(--sp-6) var(--sp-7)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "999px",
                  // Iniciais em branco: o mesmo sólido da bolha e do `.upm-avatar`.
                  background: "var(--accent-solid)",
                  color: "var(--on-solid)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  // Medium, igual ao `.upm-avatar` da barra lateral: este
                  // círculo é uma cópia à mão dele e tem de pesar o mesmo.
                  fontWeight: "var(--fw-medium)",
                  flex: "none",
                }}
              >
                {active.other.initials}
              </span>
              <div style={{ display: "grid", minWidth: 0, flex: 1 }}>
                <strong style={{ fontSize: "var(--fs-body-lg)" }}>{active.other.name}</strong>
                <a
                  href={`/market/${active.propertyId}`}
                  style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}
                >
                  {t("viewProperty", { title: active.propertyTitle })}
                </a>
              </div>
              {active.canShareAddress ? (
                <Button
                  variant="secondary"
                  onClick={shareAddress}
                  disabled={pending || active.addressShared}
                  leadingIcon={<MapPin size={14} aria-hidden="true" />}
                >
                  {active.addressShared ? t("addressShared") : t("shareAddress")}
                </Button>
              ) : null}
            </header>

            <div className="upm-messages__scroll">
              {active.messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    display: "flex",
                    justifyContent: message.mine ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "68%",
                      display: "grid",
                      gap: "var(--sp-1)",
                      padding: "var(--sp-4) var(--sp-5)",
                      borderRadius: "var(--r-xl)",
                      // `--accent-solid`, não `--accent`: a bolha é um fundo
                      // sólido com texto branco por cima, e o acento escuro é
                      // claro de mais para isso (ver tokens.css).
                      border: `1px solid ${message.mine ? "var(--accent-solid)" : "var(--border)"}`,
                      background: message.mine ? "var(--accent-solid)" : "var(--surface)",
                      color: message.mine ? "var(--on-solid)" : "var(--text)",
                    }}
                  >
                    {message.body ? (
                      <span style={{ fontSize: "var(--fs-body-lg)", lineHeight: 1.5 }}>
                        {message.body}
                      </span>
                    ) : null}
                    {message.attachments.map((attachment) => (
                      <span
                        key={attachment.path}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: "var(--sp-3)",
                          padding: "var(--sp-3) var(--sp-4)",
                          borderRadius: "var(--r-lg)",
                          border: `1px solid ${message.mine ? "var(--on-solid)" : "var(--border)"}`,
                        }}
                      >
                        <Paperclip size={14} aria-hidden="true" />
                        <button
                          type="button"
                          onClick={() => openAttachment(message.id, attachment.path)}
                          disabled={pending}
                          /* Botão e não ligação: a URL assinada só existe
                             depois de o servidor a emitir e registar (§13.3). */
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "inherit",
                            font: "inherit",
                            textDecoration: "underline",
                            cursor: "pointer",
                            minWidth: 0,
                          }}
                        >
                          {attachment.name}
                        </button>
                        <span style={{ opacity: 0.75, fontSize: "var(--fs-body)" }}>
                          {formatBytes(attachment.size)}
                        </span>
                        {/* "Guardar na Cloud" — nunca automático, e para os dois
                            lados da conversa (07 §19.6). Sem Cloud no plano, a
                            função SQL recusa e a mensagem que volta é o convite
                            de §19.4. */}
                        <button
                          type="button"
                          onClick={() => saveToCloud(message.id, attachment.path)}
                          disabled={pending}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "inherit",
                            font: "inherit",
                            opacity: 0.85,
                            textDecoration: "underline",
                            cursor: "pointer",
                          }}
                        >
                          {t("saveToCloud")}
                        </button>
                      </span>
                    ))}
                    <span
                      style={{
                        fontSize: "var(--fs-body)",
                        opacity: 0.75,
                        justifySelf: "end",
                      }}
                    >
                      {formatTime(message.createdAt, intlLocale)}
                      {message.mine ? (message.read ? " ✓✓" : " ✓") : ""}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={listEnd} />
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "var(--sp-4)",
                padding: "var(--sp-5) var(--sp-6)",
                borderTop: "1px solid var(--border)",
              }}
            >
              {/* Anexos (07 §19.6 · fecha D28): 25 MB, PDF/JPG/PNG, validados
                  pela assinatura de conteúdo no servidor. O `accept` é só
                  conveniência do seletor — quem decide é o servidor. */}
              <input
                ref={filePicker}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                hidden
                onChange={(event) => {
                  attach(event.target.files?.[0]);
                  // Limpar o input deixa reenviar o mesmo ficheiro a seguir.
                  event.target.value = "";
                }}
              />
              <Button
                variant="ghost"
                iconOnly
                aria-label={t("attach")}
                disabled={pending || !onSendAttachment}
                onClick={() => filePicker.current?.click()}
                leadingIcon={<Paperclip size={18} aria-hidden="true" />}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input
                  label={t("compose")}
                  labelHidden
                  placeholder={t("compose")}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                iconOnly
                aria-label={t("send")}
                disabled={pending || draft.trim().length === 0}
                leadingIcon={<Send size={17} aria-hidden="true" />}
              />
            </form>
          </>
        ) : (
          <div style={{ padding: "var(--sp-9)" }}>
            <EmptyState title={t("pickTitle")} description={t("pickBody")} />
          </div>
        )}
      </section>
    </div>
  );
}
