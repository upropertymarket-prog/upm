"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@upm/db/client";

import { MessagesScreen, type MessagesScreenProps } from "./MessagesScreen";

export type MessagesPageClientProps = Pick<
  MessagesScreenProps,
  "conversations" | "active" | "onSend" | "onShareAddress"
> & {
  onMarkRead: (conversationId: string) => Promise<{ error?: string }>;
};

/**
 * Cola entre a página (Server Component) e o ecrã de Mensagens
 * =========================================================================
 * Faz três coisas que só existem no cliente e que o `MessagesScreen` não deve
 * conhecer, para continuar a poder ser montado numa storyboard com dados fixos:
 *
 * 1. navegar entre conversas por query string (`?conversa=`);
 * 2. marcar a conversa aberta como lida;
 * 3. subscrever o realtime de `messages` (02 §10) e refrescar quando chega
 *    uma mensagem nova — do outro lado ou de outro separador.
 */
export function MessagesPageClient({
  conversations,
  active,
  onSend,
  onShareAddress,
  onMarkRead,
}: MessagesPageClientProps) {
  const router = useRouter();
  const activeId = active?.id ?? null;
  const hasUnread = (active?.unread ?? 0) > 0;

  useEffect(() => {
    if (!activeId || !hasUnread) return;
    void onMarkRead(activeId).then(() => router.refresh());
  }, [activeId, hasUnread, onMarkRead, router]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("upm-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () =>
        router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <MessagesScreen
      conversations={conversations}
      active={active}
      onSend={onSend}
      onShareAddress={onShareAddress}
      onSelect={(id) => router.push(`/mensagens?conversa=${id}`)}
      onRefresh={() => router.refresh()}
    />
  );
}
