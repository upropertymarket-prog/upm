import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import {
  MAIL_FOLDERS,
  type MailDatabase,
  type MailFolder,
  type MailLabelRow,
  type MailMessageRow,
} from "./pending-types";

/**
 * Caixa de e-mail do Suporte (P10-04 · 04 §2.5 · 05 §1.8)
 * =========================================================================
 * A leitura é direta, com RLS: `mail_messages` abre a `is_staff()`. **A escrita
 * nunca é direta** — passa pelas funções `security definer` de
 * `20261013120000_mail_actions.sql`, porque uma policy de `update` não
 * distingue colunas e deixaria reescrever o `html` e o remetente de um e-mail
 * recebido. O que aqui se exporta espelha exatamente essas quatro portas.
 *
 * O conteúdo das mensagens **não é sanitizado aqui**: 02 §4.3 manda renderizar
 * o e-mail recebido num `iframe` com `sandbox`, e é isso que o ecrã faz. Passar
 * o HTML por um sanitizador e depois injetá-lo na página daria uma segurança
 * aparente e um vetor a sério; o isolamento do iframe não depende de acertarmos
 * numa lista de etiquetas.
 */

type AnySupabaseClient = SupabaseClient<Database>;

/**
 * O único cast do correio, e está aqui. Os tipos gerados ainda não conhecem as
 * tabelas do correio (D64); `pending-types.ts` declara-as, e esta função é a
 * costura entre o cliente que a app cria e esse tipo. Desaparece com o
 * `db:types`.
 */
function mailClient(client: AnySupabaseClient): SupabaseClient<MailDatabase> {
  return client as unknown as SupabaseClient<MailDatabase>;
}

export { MAIL_FOLDERS };
export type { MailFolder, MailLabelRow, MailMessageRow };

/** O que a lista mostra. O corpo não vem: 50 mensagens × HTML é muito payload. */
export type MailListItem = Pick<
  MailMessageRow,
  | "id"
  | "subject"
  | "from_address"
  | "from_name"
  | "folder"
  | "is_read"
  | "is_starred"
  | "labels"
  | "ticket_id"
  | "sent_at"
  | "received_at"
> & { preview: string; has_attachments: boolean };

export type MailboxOption = {
  id: string;
  address: string;
  displayName: string;
  department: string;
  status: string;
};

const LIST_COLUMNS =
  "id, subject, from_address, from_name, folder, is_read, is_starred, labels, ticket_id, sent_at, received_at, text_body, attachments";

export async function listMailboxOptions(client: AnySupabaseClient): Promise<MailboxOption[]> {
  const { data, error } = await client
    .from("mailboxes")
    .select("id, address, display_name, department, status")
    .order("address", { ascending: true });

  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    address: row.address,
    displayName: row.display_name,
    department: row.department,
    status: row.status,
  }));
}

export type MailListFilters = {
  mailboxId: string;
  folder?: MailFolder;
  labelId?: string;
  search?: string;
  starred?: boolean;
  limit?: number;
};

export async function listMail(
  client: AnySupabaseClient,
  filters: MailListFilters,
): Promise<MailListItem[]> {
  let query = mailClient(client)
    .from("mail_messages")
    .select(LIST_COLUMNS)
    .eq("mailbox_id", filters.mailboxId)
    .eq("folder", filters.folder ?? "inbox");

  if (filters.labelId) query = query.contains("labels", [filters.labelId]);
  if (filters.starred) query = query.eq("is_starred", true);

  // Assunto **ou** remetente: quem procura "ana" tanto pode estar a lembrar-se
  // do assunto como de quem escreveu. O `%` é escapado porque vem do campo de
  // pesquisa, e um `%` solto transformaria a procura num "tudo".
  if (filters.search) {
    const safe = filters.search.replace(/[%_]/g, (match) => `\\${match}`);
    query = query.or(`subject.ilike.%${safe}%,from_address.ilike.%${safe}%`);
  }

  const { data, error } = await query
    .order("received_at", { ascending: false })
    .limit(filters.limit ?? 50);

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    subject: row.subject,
    from_address: row.from_address,
    from_name: row.from_name,
    folder: row.folder,
    is_read: row.is_read,
    is_starred: row.is_starred,
    labels: row.labels,
    ticket_id: row.ticket_id,
    sent_at: row.sent_at,
    received_at: row.received_at,
    preview: (row.text_body ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
    // Só se há ou não: o nome e o tamanho ficam para a leitura, e a lista não
    // precisa de arrastar o `jsonb` inteiro para desenhar um clipe.
    has_attachments: Array.isArray(row.attachments) && row.attachments.length > 0,
  }));
}

export async function getMailMessage(
  client: AnySupabaseClient,
  messageId: string,
): Promise<MailMessageRow | null> {
  const { data } = await mailClient(client)
    .from("mail_messages")
    .select("*")
    .eq("id", messageId)
    .maybeSingle();

  return data ?? null;
}

export async function listMailLabels(
  client: AnySupabaseClient,
  mailboxId: string,
): Promise<MailLabelRow[]> {
  const { data } = await mailClient(client)
    .from("mail_labels")
    .select("*")
    .eq("mailbox_id", mailboxId)
    .order("name", { ascending: true });

  return data ?? [];
}

/** Os contadores das pastas, para o menu lateral da caixa não mentir. */
export async function mailFolderCounts(
  client: AnySupabaseClient,
  mailboxId: string,
): Promise<Record<MailFolder, number> & { unread: number; starred: number }> {
  const counts = {
    inbox: 0,
    sent: 0,
    drafts: 0,
    archive: 0,
    unread: 0,
    starred: 0,
  };

  const { data } = await mailClient(client)
    .from("mail_messages")
    .select("folder, is_read, is_starred")
    .eq("mailbox_id", mailboxId)
    .limit(1000);

  for (const row of data ?? []) {
    counts[row.folder] += 1;
    if (!row.is_read && row.folder === "inbox") counts.unread += 1;
    if (row.is_starred) counts.starred += 1;
  }

  return counts;
}

export async function mailUnreadCount(client: AnySupabaseClient): Promise<number> {
  const { data, error } = await mailClient(client).rpc("mail_unread_count");
  if (error || typeof data !== "number") return 0;
  return data;
}

// ---------------------------------------------------------------------------
// Escritas — uma função por porta, com o mesmo nome do RPC que chamam
// ---------------------------------------------------------------------------

export const mailFlagsSchema = z.object({
  messageId: z.string().uuid(),
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
});

export async function setMailFlags(
  client: AnySupabaseClient,
  input: z.infer<typeof mailFlagsSchema>,
): Promise<void> {
  const { error } = await mailClient(client).rpc("mail_set_flags", {
    p_message_id: input.messageId,
    p_is_read: input.isRead,
    p_is_starred: input.isStarred,
  });
  if (error) throw new Error(error.message);
}

export const mailMoveSchema = z.object({
  messageId: z.string().uuid(),
  // Só os dois destinos que a função aceita: `sent` e `drafts` descrevem a
  // origem da mensagem, não um sítio para onde se arrasta.
  folder: z.enum(["inbox", "archive"]),
});

export async function moveMail(
  client: AnySupabaseClient,
  input: z.infer<typeof mailMoveSchema>,
): Promise<void> {
  const { error } = await mailClient(client).rpc("mail_move", {
    p_message_id: input.messageId,
    p_folder: input.folder,
  });
  if (error) throw new Error(error.message);
}

export const mailLabelsSchema = z.object({
  messageId: z.string().uuid(),
  labelIds: z.array(z.string().uuid()).max(20),
});

export async function setMailLabels(
  client: AnySupabaseClient,
  input: z.infer<typeof mailLabelsSchema>,
): Promise<void> {
  const { error } = await mailClient(client).rpc("mail_set_labels", {
    p_message_id: input.messageId,
    p_labels: input.labelIds,
  });
  if (error) throw new Error(error.message);
}

export const mailLabelCreateSchema = z.object({
  mailboxId: z.string().uuid(),
  name: z.string().trim().min(1, "O marcador precisa de um nome.").max(40),
  // Tokens do design system, nunca hexadecimais (04 §5.1).
  color: z.enum(["accent", "success", "warning", "danger", "info", "muted"]).default("accent"),
});

export async function createMailLabel(
  client: AnySupabaseClient,
  input: z.infer<typeof mailLabelCreateSchema>,
): Promise<MailLabelRow | null> {
  const { data, error } = await mailClient(client)
    .from("mail_labels")
    .insert({ mailbox_id: input.mailboxId, name: input.name, color: input.color })
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export type TicketFromMail = { id: string; ref: string; created: boolean };

export async function createTicketFromMail(
  client: AnySupabaseClient,
  messageId: string,
): Promise<TicketFromMail> {
  const { data, error } = await mailClient(client).rpc("create_ticket_from_mail", {
    p_message_id: messageId,
  });

  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("A função não devolveu o ticket.");
  return row;
}
