"use server";

import { clientIpFrom } from "@upm/config/security";
import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import { planLimitMessage } from "@upm/db/billing";
import { MAX_FILE_BYTES, sniffMime } from "@upm/db/cloud";
import { messageSchema, parseAttachments, type MessageInput } from "@upm/db/interaction";

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

// ---------------------------------------------------------------------------
// Anexos do chat — 07 §19.6 (fecha D28)
//
// O bucket `chat-attachments`, as suas policies de participante e o limite de
// 25 MB existem desde a Fase 6; o que faltava era esta camada. Três decisões
// de 07 §19.6 estão aqui, e não na UI:
//
//  - **Qualquer utilizador pode anexar**, tenha Cloud ou não: o anexo vive no
//    caminho da conversa e está fora da quota da Cloud (§19.8 #6). Só "Guardar
//    na Cloud" entra na quota, e aí é a função SQL que decide.
//  - **O id da mensagem nasce aqui**, antes do upload: o caminho combinado é
//    `{conversation_id}/{message_id}/{nome}` e `messages` não tem policy de
//    update — não há como acrescentar o anexo depois de a mensagem existir.
//    Objeto primeiro, linha depois; se a linha falhar, o objeto é removido,
//    tal como no upload da Cloud.
//  - **Ler um anexo fica registado** (§13.3), com o id da mensagem como
//    assunto — `20261006120000_chat_attachment_access.sql`.
// ---------------------------------------------------------------------------

/** Sem barras nem `..`: o nome entra num caminho de Storage. */
function safeFileName(name: string) {
  const cleaned = name
    .replace(/[\\/]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .trim();
  return (cleaned || "anexo").slice(0, 120);
}

export async function sendAttachment(formData: FormData): Promise<ConversationActionState> {
  const conversationId = formData.get("conversationId");
  const file = formData.get("file");

  if (typeof conversationId !== "string" || !z.string().uuid().safeParse(conversationId).success) {
    return { error: "Conversa inválida." };
  }
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um ficheiro." };
  if (file.size > MAX_FILE_BYTES) return { error: "O ficheiro excede 25 MB." };

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) return { error: "Só se aceitam ficheiros PDF, JPG e PNG." };

  const messageId = randomUUID();
  const name = safeFileName(file.name);
  const path = `${conversationId}/${messageId}/${name}`;

  // A policy do bucket exige participação na conversa: quem não pertence à
  // conversa falha aqui, antes de qualquer linha ser escrita.
  const { error: uploadError } = await supabase.storage
    .from("chat-attachments")
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (uploadError) return { error: "Não foi possível carregar o ficheiro." };

  const { error } = await supabase.from("messages").insert({
    id: messageId,
    conversation_id: conversationId,
    sender_id: user.id,
    body: "",
    attachments: [{ path, name, mime, size: file.size }],
  });
  if (error) {
    await supabase.storage.from("chat-attachments").remove([path]);
    return { error: "Não foi possível enviar o anexo." };
  }

  revalidatePath("/mensagens");
  return { ok: true };
}

/** Ligação assinada e curta para abrir ou transferir um anexo, com registo. */
export async function attachmentUrl(
  messageId: string,
  path: string,
  action: "view" | "download" = "download",
): Promise<{ url?: string; error?: string }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  // O anexo pertence à mensagem, e a mensagem só é legível por quem participa
  // na conversa (policy `messages_participants_select`). É esta leitura que
  // autoriza — nunca o caminho que o cliente mandou.
  const { data: message } = await supabase
    .from("messages")
    .select("id, attachments")
    .eq("id", messageId)
    .maybeSingle();
  const attachment = parseAttachments(message?.attachments).find((item) => item.path === path);
  if (!attachment) return { error: "Anexo inexistente." };

  const requestHeaders = await headers();
  await supabase.rpc("log_document_access", {
    p_subject_type: "chat_attachment",
    p_subject_id: messageId,
    p_action: action,
    p_ip: clientIpFrom(requestHeaders) ?? undefined,
    p_user_agent: requestHeaders.get("user-agent") ?? undefined,
    p_bytes_sent: action === "download" ? attachment.size : undefined,
  });

  const { data, error } = await supabase.storage
    .from("chat-attachments")
    .createSignedUrl(attachment.path, 60, {
      download: action === "download" ? attachment.name : undefined,
    });
  if (error || !data) return { error: "Não foi possível abrir o anexo." };

  return { url: data.signedUrl };
}

/**
 * "Guardar na Cloud" — nunca automático (07 §19.6), e vale para os dois lados.
 *
 * Copia o objeto para o bucket `cloud` e registra-o com `cloud_register_upload`,
 * a mesma função do upload normal: é ela que verifica a quota e o plano. Sem
 * Cloud no plano, é ela que recusa — e a mensagem que volta é a que a UI mostra
 * como convite (§19.4). O anexo continua na conversa; isto é uma cópia.
 */
export async function saveAttachmentToCloud(
  messageId: string,
  path: string,
  folderId?: string | null,
): Promise<ConversationActionState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { data: message } = await supabase
    .from("messages")
    .select("id, attachments")
    .eq("id", messageId)
    .maybeSingle();
  const attachment = parseAttachments(message?.attachments).find((item) => item.path === path);
  if (!attachment) return { error: "Anexo inexistente." };

  const { data: blob, error: downloadError } = await supabase.storage
    .from("chat-attachments")
    .download(attachment.path);
  if (downloadError || !blob) return { error: "Não foi possível ler o anexo." };

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const storagePath = `${user.id}/${randomUUID()}/1`;
  const { error: uploadError } = await supabase.storage
    .from("cloud")
    .upload(storagePath, bytes, { contentType: attachment.mime, upsert: false });
  if (uploadError) return { error: "Não foi possível guardar na Cloud." };

  const { error } = await supabase.rpc("cloud_register_upload", {
    p_folder_id: (folderId ?? null) as unknown as string,
    p_name: attachment.name,
    p_mime: attachment.mime,
    p_size: attachment.size,
    p_storage_path: storagePath,
    p_checksum: createHash("sha256").update(bytes).digest("hex"),
  });
  if (error) {
    // Quota, pasta inválida ou plano sem Cloud: o objeto não fica a ocupar
    // espaço que nenhum `files` contabiliza.
    await supabase.storage.from("cloud").remove([storagePath]);
    return { error: error.message || "Não foi possível guardar na Cloud." };
  }

  revalidatePath("/cloud");
  revalidatePath("/mensagens");
  return { ok: true };
}
