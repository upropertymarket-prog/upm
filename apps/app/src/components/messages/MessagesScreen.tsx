"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MapPin, Paperclip, Search, Send } from "lucide-react";
import { Badge, Button, EmptyState, Input, useToast } from "@upm/ui";

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
  onSelect,
  onRefresh,
}: MessagesScreenProps) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const listEnd = useRef<HTMLDivElement>(null);

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

  function shareAddress() {
    if (!active) return;
    startTransition(async () => {
      const result = await onShareAddress(active.propertyId, active.buyerId);
      toast(
        result.error ?? `Morada exata partilhada com ${active.other.name}.`,
        result.error ? "error" : "success",
      );
      onRefresh?.();
    });
  }

  return (
    <div className="upm-messages">
      <section aria-label="Conversas" className="upm-messages__list">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
          <h2 style={{ margin: 0, fontSize: "var(--fs-subtitle-lg)" }}>Conversas</h2>
          {unreadTotal > 0 ? (
            <Badge srLabel={`${unreadTotal} conversas por ler`}>{unreadTotal}</Badge>
          ) : null}
        </div>
        <Input
          label="Procurar conversa"
          labelHidden
          placeholder="Procurar conversa"
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
                      {item.lastMessageAt ? formatRelative(item.lastMessageAt) : ""}
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: "var(--fs-body)",
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
                      {item.lastMessage || "Sem mensagens"}
                    </span>
                    {item.unread > 0 ? (
                      <Badge srLabel={`${item.unread} mensagens por ler`}>{item.unread}</Badge>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 ? (
          <EmptyState
            title={
              conversations.length === 0 ? "Ainda sem conversas" : "Nenhuma conversa encontrada"
            }
            description={
              conversations.length === 0
                ? "As conversas começam no detalhe de um imóvel, em «Contactar proprietário»."
                : "Tente outro nome ou outro imóvel."
            }
          />
        ) : null}
      </section>

      <section aria-label="Conversa" className="upm-messages__thread">
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
                  fontWeight: "var(--fw-black)",
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
                  Ver imóvel · {active.propertyTitle}
                </a>
              </div>
              {active.canShareAddress ? (
                <Button
                  variant="secondary"
                  onClick={shareAddress}
                  disabled={pending || active.addressShared}
                  leadingIcon={<MapPin size={14} aria-hidden="true" />}
                >
                  {active.addressShared ? "Morada partilhada" : "Partilhar morada exata"}
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
                    <span style={{ fontSize: "var(--fs-body-lg)", lineHeight: 1.5 }}>
                      {message.body}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--fs-body)",
                        opacity: 0.75,
                        justifySelf: "end",
                      }}
                    >
                      {formatTime(message.createdAt)}
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
              {/* Anexos são da Fase 6 (Cloud e contratos): `messages.attachments`
                  existe, o seletor de ficheiros vive lá. */}
              <Button
                variant="ghost"
                iconOnly
                aria-label="Anexar ficheiro (Fase 6)"
                disabled
                leadingIcon={<Paperclip size={18} aria-hidden="true" />}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input
                  label="Escreva uma mensagem"
                  labelHidden
                  placeholder="Escreva uma mensagem"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                iconOnly
                aria-label="Enviar mensagem"
                disabled={pending || draft.trim().length === 0}
                leadingIcon={<Send size={17} aria-hidden="true" />}
              />
            </form>
          </>
        ) : (
          <div style={{ padding: "var(--sp-9)" }}>
            <EmptyState
              title="Escolha uma conversa"
              description="À esquerda estão as conversas por imóvel. Nenhuma ainda? Abra o detalhe de um imóvel e use «Contactar proprietário»."
            />
          </div>
        )}
      </section>
    </div>
  );
}
