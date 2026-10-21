import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Constants, type Database, type Tables } from "./database.types";
import { readMailAttachments, type MailAttachment } from "./mail-attachments";

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
 * O cast do correio saiu a 21 out 2026, com a D64 fechada.
 *
 * Existia uma função `mailClient()` aqui, a costurar o cliente que a app cria
 * com o `MailDatabase` de `pending-types.ts` — as tabelas do correio escritas
 * à mão porque o `database.types.ts` não as conhecia. O `pnpm db:types` passou
 * a correr e passou a conhecê-las; o tipo à mão deixou de ser preciso e, mais
 * do que isso, deixou de ser verdade: tinha divergido do esquema real.
 *
 * As tabelas e os enums vêm agora do ficheiro gerado, e é por isso que estes
 * nomes continuam a ser exportados daqui — é esta a porta do correio para o
 * resto do produto, e quem os importa não tem de saber de onde vêm.
 */
export const MAIL_FOLDERS = Constants.public.Enums.mail_folder;
export type MailFolder = (typeof MAIL_FOLDERS)[number];
export type MailLabelRow = Tables<"mail_labels">;
export type MailMessageRow = Tables<"mail_messages">;
export { readMailAttachments };
export type { MailAttachment };

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
  let query = client
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
  const { data } = await client.from("mail_messages").select("*").eq("id", messageId).maybeSingle();

  return data ?? null;
}

export async function listMailLabels(
  client: AnySupabaseClient,
  mailboxId: string,
): Promise<MailLabelRow[]> {
  const { data } = await client
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

  const { data } = await client
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
  const { data, error } = await client.rpc("mail_unread_count");
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
  const { error } = await client.rpc("mail_set_flags", {
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
  const { error } = await client.rpc("mail_move", {
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
  const { error } = await client.rpc("mail_set_labels", {
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
  const { data, error } = await client
    .from("mail_labels")
    .insert({ mailbox_id: input.mailboxId, name: input.name, color: input.color })
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

// ---------------------------------------------------------------------------
// Anexos (D66) — ler a lista, e as duas portas de "Guardar na Cloud"
// ---------------------------------------------------------------------------

/**
 * Os anexos de uma mensagem, já validados. A coluna é `jsonb` e as mensagens
 * que entraram antes de D66 ser paga não têm `path` — `readMailAttachments`
 * trata-as como anexos sem bytes em vez de deixar o ecrã rebentar.
 */
export function mailAttachmentsOf(message: Pick<MailMessageRow, "attachments">): MailAttachment[] {
  return readMailAttachments(message.attachments);
}

/** O índice é a posição na lista, e é por isso que ele é a metade da chave. */
export const mailAttachmentSchema = z.object({
  messageId: z.string().uuid(),
  index: z.number().int().min(0).max(99),
});

/**
 * `cloudStaffFileSchema` e `registerStaffCloudFile` **mudaram-se para
 * `@upm/db/cloud`** em P10-10. Nasceram aqui com D66 porque o primeiro
 * chamador foi o anexo de correio, mas o que fazem é registar um ficheiro na
 * Cloud — e em P10-10 passaram a ter um segundo chamador, o ecrã da Cloud
 * interna. Ficar no módulo do correio obrigava a Cloud a importar correio.
 */

/** A nota, no próprio anexo, de que já lá está. Recusa a segunda cópia. */
export async function markMailAttachmentSaved(
  client: AnySupabaseClient,
  input: z.infer<typeof mailAttachmentSchema> & { fileId: string },
): Promise<void> {
  const { error } = await client.rpc("mail_attachment_saved_to_cloud", {
    p_message_id: input.messageId,
    p_index: input.index,
    p_file_id: input.fileId,
  });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Composer (P10-05)
// ---------------------------------------------------------------------------

/**
 * A assinatura da caixa, já com as variáveis de quem é dono dela resolvidas.
 * Resolvida na base de dados e não aqui: o composer de hoje e as campanhas de
 * amanhã têm de obter exatamente a mesma coisa (05 §1.8).
 */
export async function mailboxSignature(
  client: AnySupabaseClient,
  mailboxId: string,
): Promise<string> {
  const { data, error } = await client.rpc("mailbox_signature", {
    p_mailbox_id: mailboxId,
  });
  if (error || typeof data !== "string") return "";
  return data;
}

export const mailDraftSchema = z.object({
  mailboxId: z.string().uuid(),
  draftId: z.string().uuid().nullish(),
  to: z.array(z.string().trim().email("Destinatário inválido.")).max(50),
  cc: z.array(z.string().trim().email("Cc inválido.")).max(50).default([]),
  bcc: z.array(z.string().trim().email("Bcc inválido.")).max(50).default([]),
  subject: z.string().max(500).default(""),
  html: z.string().max(500_000).default(""),
  text: z.string().max(200_000).default(""),
  inReplyTo: z.string().max(400).nullish(),
});

export type MailDraftInput = z.infer<typeof mailDraftSchema>;

export async function saveMailDraft(
  client: AnySupabaseClient,
  input: MailDraftInput,
): Promise<string> {
  const { data, error } = await client.rpc("mail_save_draft", {
    p_mailbox_id: input.mailboxId,
    p_draft_id: input.draftId ?? undefined,
    p_to: input.to,
    p_cc: input.cc,
    p_bcc: input.bcc,
    p_subject: input.subject,
    p_html: input.html,
    p_text: input.text,
    p_in_reply_to: input.inReplyTo ?? undefined,
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function discardMailDraft(client: AnySupabaseClient, draftId: string): Promise<void> {
  const { error } = await client.rpc("mail_discard_draft", {
    p_draft_id: draftId,
  });
  if (error) throw new Error(error.message);
}

/** O envio exige pelo menos um destinatário; gravar um rascunho não. */
export const mailSendSchema = mailDraftSchema.extend({
  to: z.array(z.string().trim().email("Destinatário inválido.")).min(1, "Falta o destinatário."),
});

export type TicketFromMail = { id: string; ref: string; created: boolean };

export async function createTicketFromMail(
  client: AnySupabaseClient,
  messageId: string,
): Promise<TicketFromMail> {
  const { data, error } = await client.rpc("create_ticket_from_mail", {
    p_message_id: messageId,
  });

  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("A função não devolveu o ticket.");
  return row;
}
