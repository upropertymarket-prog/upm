"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import { planLimitMessage } from "@upm/db/billing";
import { messageSchema, type MessageInput } from "@upm/db/interaction";

/**
 * Conversas e mensagens (P5-01) — 03 F5, 05 §6.3.
 * =========================================================================
 * Nenhuma destas ações escreve diretamente nas tabelas: as regras (quem pode
 * falar com quem, sobre que imóvel, e a criação da lead) vivem nas funções
 * `security definer` da migração `20260929120000_interaction.sql`. Aqui
 * valida-se o input com `zod` e confirma-se a sessão, como 08 §3.2 exige —
 * por cima da RLS, nunca em vez dela.
 */

export type ConversationActionState = { ok?: boolean; error?: string };
export type StartConversationState = { id?: string; error?: string };

/** 03 F5 — "Contactar proprietário (cria conversation)". Fecha metade de D20. */
export async function startConversation(propertyId: string): Promise<StartConversationState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { data, error } = await supabase.rpc("start_conversation", {
    p_property_id: propertyId,
  });
  if (error || !data) {
    return { error: planLimitMessage(error) ?? "Não foi possível abrir a conversa." };
  }

  revalidatePath("/mensagens");
  return { id: data };
}

export async function sendMessage(input: MessageInput): Promise<ConversationActionState> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Mensagem inválida." };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  // `sender_id` sai da sessão e nunca do cliente (08 §7.3): a policy de insert
  // exige `sender_id = auth.uid()`, mas confiar só nisso deixava a decisão de
  // quem assina a mensagem do lado de fora.
  const { error } = await supabase.from("messages").insert({
    conversation_id: parsed.data.conversation_id,
    sender_id: user.id,
    body: parsed.data.body,
  });
  if (error) return { error: "Não foi possível enviar a mensagem." };

  revalidatePath("/mensagens");
  return { ok: true };
}

export async function markConversationRead(
  conversationId: string,
): Promise<ConversationActionState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
  });
  if (error) return { error: "Não foi possível marcar a conversa como lida." };

  revalidatePath("/mensagens");
  return { ok: true };
}

/** 07 §1.2.6 — partilha manual da morada exata a partir do chat. */
export async function shareExactAddress(
  propertyId: string,
  buyerId: string,
): Promise<ConversationActionState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("share_exact_address", {
    p_property_id: propertyId,
    p_buyer_id: buyerId,
  });
  if (error) return { error: "Não foi possível partilhar a morada." };

  revalidatePath("/mensagens");
  return { ok: true };
}
