"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import { notificationPrefsSchema, type NotificationPrefs } from "@upm/db/interaction";

/**
 * Notificações (P5-04) — 02 §10, 05 §6.9.
 * =========================================================================
 * O sino lê `notifications` por RLS (só as próprias). Marcar como lida é a
 * única escrita do cliente; a criação é sempre do servidor, por trigger.
 *
 * As preferências vivem em `profiles.notification_prefs` e são lidas pela
 * função `notify()` no momento de notificar — não há cópia nenhuma delas.
 */

export type NotificationActionState = { ok?: boolean; error?: string };

export async function markAllNotificationsRead(): Promise<NotificationActionState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .is("read_at", null);
  if (error) return { error: "Não foi possível marcar as notificações." };

  revalidatePath("/painel");
  return { ok: true };
}

export async function markNotificationRead(id: string): Promise<NotificationActionState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", user.id);
  if (error) return { error: "Não foi possível marcar a notificação." };

  return { ok: true };
}

/** Definições › Notificações (04 §8.3). Guarda o mapa inteiro, não um campo. */
export async function updateNotificationPrefs(
  prefs: NotificationPrefs,
): Promise<NotificationActionState> {
  const parsed = notificationPrefsSchema.safeParse(prefs);
  if (!parsed.success) return { error: "Preferências inválidas." };

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase
    .from("profiles")
    .update({ notification_prefs: parsed.data })
    .eq("id", user.id);
  if (error) return { error: "Não foi possível guardar as preferências." };

  revalidatePath("/definicoes");
  return { ok: true };
}
