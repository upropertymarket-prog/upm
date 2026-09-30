"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@upm/db/client";
import type { Notification } from "@upm/ui";

import { formatRelative } from "../interaction/interactionTypes";

/**
 * O sino da topbar, ao vivo (P5-04 · 02 §10 · 04 §5.5)
 * =========================================================================
 * O sino é igual em todas as páginas, e uma notificação que chega enquanto se
 * está no Market tem de aparecer sem recarregar. Por isso lê aqui, no cliente,
 * em vez de cada página o passar por prop: são doze linhas da própria conta,
 * protegidas pela RLS de `notifications` (só `profile_id = auth.uid()`).
 *
 * `initial` vem do servidor quando a página já as tinha à mão — dá o primeiro
 * render sem esperar pela rede. Uma storyboard passa `initial` e `live: false`
 * e o hook nunca toca no Supabase, que é o que a mantém montável sem sessão.
 */
export function useNotifications(initial: Notification[] = [], live = true) {
  const [items, setItems] = useState<Notification[]>(initial);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(12);
    if (!data) return;

    setItems(
      data.map((row) => ({
        id: row.id,
        text: row.body ? `${row.title} — ${row.body}` : row.title,
        when: formatRelative(row.created_at),
        read: row.read_at !== null,
        href: row.link ?? undefined,
      })),
    );
  }, []);

  useEffect(() => {
    if (!live) return;

    // Só vai à rede quando o servidor não trouxe nada: nas páginas que já
    // carregaram as notificações, a primeira leitura seria uma repetição.
    if (initial.length === 0) void load();

    const supabase = createClient();
    const channel = supabase
      .channel("upm-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => void load(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // `initial` só conta no arranque; incluí-lo faria refazer a subscrição a
    // cada render do servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, load]);

  const markAllRead = useCallback(async () => {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    if (!live) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("profile_id", user.id)
      .is("read_at", null);
  }, [live]);

  return { items, markAllRead };
}
