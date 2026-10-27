"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Paperclip, Search, Send } from "lucide-react";
import { Badge, Button, Input } from "@upm/ui";
import {
  DEMO_BUYER_CONVERSATIONS,
  DEMO_OWNER_CONVERSATIONS,
  type DemoConversation,
} from "@upm/ui/demo-data";

import { useDemoFormat, type DemoRole } from "./format";

/**
 * Mensagens da demonstração — 04 §8.3, 07 §19.6
 * =========================================================================
 * As duas colunas do produto: conversas à esquerda, a conversa à direita, com
 * as bolhas, a hora e os dois visto. O que 04 §2.6 promete ao visitante é
 * exatamente o que se vê aqui — "comunica de forma segura, por chat, sem
 * partilha de contactos pessoais" —, por isso o botão de partilhar a morada
 * exata está à vista: é a única coisa que sai do chat, e sai por decisão de
 * quem publica.
 *
 * **Escolher uma conversa funciona**, porque é disso que este ecrã é feito.
 * Escrever e anexar desenham-se: não há para onde enviar.
 */

function ConversationList({
  conversations,
  activeId,
  onSelect,
}: {
  conversations: DemoConversation[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("messages");
  const format = useDemoFormat();
  const [query, setQuery] = useState("");

  const unreadTotal = conversations.reduce((total, item) => total + item.unread, 0);
  const visible = query
    ? conversations.filter((item) =>
        `${item.other} ${item.property}`.toLowerCase().includes(query.toLowerCase()),
      )
    : conversations;

  return (
    <section aria-label={t("listLabel")} className="upm-demo-list">
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
        <h2 style={{ margin: 0, fontSize: "var(--fs-body-lg)" }}>{t("listTitle")}</h2>
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

      <ul className="upm-demo-list__items">
        {visible.map((item) => {
          const open = item.id === activeId;
          const last = item.messages[item.messages.length - 1];
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
                  padding: "var(--sp-4)",
                  border: "1px solid var(--border)",
                  borderLeft: `3px solid ${open ? "var(--accent)" : "transparent"}`,
                  borderRadius: "var(--r-xl)",
                  background: open ? "var(--surface2)" : "transparent",
                  cursor: "pointer",
                  color: "var(--text)",
                  font: "inherit",
                  minWidth: 0,
                }}
              >
                <span style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-3)" }}>
                  <strong
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.other}
                  </strong>
                  <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
                    {last ? format.ago(last.minutesAgo) : ""}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: "var(--fs-label)",
                    color: "var(--accent)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.property}
                </span>
                {item.unread > 0 ? (
                  <span style={{ justifySelf: "start" }}>
                    <Badge srLabel={t("unreadInConversation", { count: item.unread })}>
                      {item.unread}
                    </Badge>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Thread({ conversation }: { conversation: DemoConversation }) {
  const t = useTranslations("messages");
  const tThread = useTranslations("site.demo.thread");
  const format = useDemoFormat();

  return (
    <section aria-label={t("threadLabel")} className="upm-demo-thread">
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-5)",
          padding: "var(--sp-5) var(--sp-6)",
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 38,
            height: 38,
            borderRadius: "var(--r-pill)",
            background: "var(--accent-solid)",
            color: "var(--on-solid)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "var(--fw-medium)",
            flex: "none",
          }}
        >
          {conversation.initials}
        </span>
        <span style={{ display: "grid", gap: "var(--sp-1)", minWidth: 0, flex: 1 }}>
          <strong>{conversation.other}</strong>
          <span
            style={{
              color: "var(--muted)",
              fontSize: "var(--fs-label)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {conversation.property}
          </span>
        </span>
        <Button variant="secondary" size="sm" leadingIcon={<MapPin size={14} />}>
          {t("shareAddress")}
        </Button>
      </header>

      <div className="upm-demo-thread__scroll">
        {conversation.messages.map((message) => (
          <div
            key={message.id}
            style={{ display: "flex", justifyContent: message.mine ? "flex-end" : "flex-start" }}
          >
            <div
              style={{
                maxWidth: "72%",
                display: "grid",
                gap: "var(--sp-1)",
                padding: "var(--sp-4) var(--sp-5)",
                borderRadius: "var(--r-xl)",
                border: `1px solid ${message.mine ? "var(--accent-solid)" : "var(--border)"}`,
                background: message.mine ? "var(--accent-solid)" : "var(--surface)",
                color: message.mine ? "var(--on-solid)" : "var(--text)",
              }}
            >
              <span style={{ fontSize: "var(--fs-body)", lineHeight: 1.5 }}>
                {tThread(message.key)}
              </span>
              <span style={{ fontSize: "var(--fs-label)", opacity: 0.75, justifySelf: "end" }}>
                {format.time(format.since(message.minutesAgo))}
                {message.mine ? " ✓✓" : ""}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-4)",
          padding: "var(--sp-5) var(--sp-6)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <Button variant="ghost" iconOnly aria-label={t("attach")}>
          <Paperclip size={18} />
        </Button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input label={t("compose")} labelHidden placeholder={t("compose")} />
        </div>
        <Button iconOnly aria-label={t("send")}>
          <Send size={17} />
        </Button>
      </div>
    </section>
  );
}

export function DemoMessages({ role }: { role: DemoRole }) {
  const conversations = role === "owner" ? DEMO_OWNER_CONVERSATIONS : DEMO_BUYER_CONVERSATIONS;
  const [activeId, setActiveId] = useState(conversations[0]!.id);
  const active = conversations.find((item) => item.id === activeId) ?? conversations[0]!;

  return (
    <div
      className="upm-demo-panes"
      style={{ ["--demo-panes" as string]: "minmax(200px, 280px) minmax(0, 1fr)" }}
    >
      <ConversationList conversations={conversations} activeId={active.id} onSelect={setActiveId} />
      <Thread conversation={active} />
    </div>
  );
}
