import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";

import { describe, imapOptions } from "./connection.ts";
import type { MailMessageRow } from "./db-pending.ts";
import {
  getMailboxPassword,
  listSyncableMailboxes,
  recordSyncOutcome,
  type MailWorkerClient,
  type MailboxRow,
} from "./supabase.ts";

/**
 * Sincronização da entrada (P10-03 · 04 §2.5)
 * =========================================================================
 * Lê o que há de novo em cada caixa ativa e escreve em `mail_messages`, com a
 * conversa em `mail_threads`. É a metade do worker que faz a Caixa de e-mail de
 * P10-04 ter o que mostrar.
 *
 * ## Porque é que não guarda estado de onde ficou
 *
 * Não há cursor, nem `UIDNEXT` guardado. A passagem pede ao servidor as
 * mensagens mais recentes e deixa o `insert` decidir o que é novo, contra o
 * índice único `(mailbox_id, message_id)`. É mais trabalho para a base de dados
 * e muito menos para quem mantém isto: um cursor desalinhado — por uma caixa
 * reconstruída, por um servidor que renumera, por um worker morto a meio —
 * perde correio em silêncio, e perder correio de suporte é perder o pedido de
 * ajuda de alguém. A verificação da idempotência é barata; o risco não é.
 *
 * ## O que esta passagem não faz
 *
 * Não apaga, não move e não marca nada no servidor — abre a ligação em modo de
 * leitura. O estado "lida" vive do nosso lado (`mail_messages.is_read`), porque
 * é a equipa que trabalha na app, não no servidor IMAP. Anexos ficam em
 * `attachments` como metadados (nome, tipo, tamanho); o conteúdo só se descarrega
 * quando houver ecrã que o mostre, em P10-04.
 */

export type SyncReport = {
  mailboxId: string;
  address: string;
  fetched: number;
  inserted: number;
  error?: string;
};

export async function syncAllMailboxes(
  client: MailWorkerClient,
  options: { batch: number },
): Promise<SyncReport[]> {
  const mailboxes = await listSyncableMailboxes(client);
  const reports: SyncReport[] = [];

  // Em série, e não em paralelo: são poucas caixas e o mesmo servidor da Amen
  // serve todas — abrir cinco ligações IMAP ao mesmo host ao mesmo tempo é a
  // forma mais rápida de apanhar um limite de ligações concorrentes.
  for (const mailbox of mailboxes) {
    reports.push(await syncMailbox(client, mailbox, options));
  }

  return reports;
}

export async function syncMailbox(
  client: MailWorkerClient,
  mailbox: MailboxRow,
  options: { batch: number },
): Promise<SyncReport> {
  const report: SyncReport = {
    mailboxId: mailbox.id,
    address: mailbox.address,
    fetched: 0,
    inserted: 0,
  };

  try {
    if (mailbox.protocol !== "imap") {
      throw new Error("A sincronização por POP3 ainda não está implementada.");
    }

    const password = await getMailboxPassword(client, mailbox.id);
    if (!password) throw new Error("A caixa não tem credencial gravada no Vault.");

    const messages = await fetchRecent(mailbox, password, options.batch);
    report.fetched = messages.length;

    for (const parsed of messages) {
      const inserted = await storeMessage(client, mailbox, parsed);
      if (inserted) report.inserted += 1;
    }

    await recordSyncOutcome(client, mailbox.id, { ok: true });
  } catch (error) {
    report.error = describe(error);
    await recordSyncOutcome(client, mailbox.id, { ok: false, error: report.error });
  }

  return report;
}

/** As `batch` mensagens mais recentes da INBOX, em leitura. */
async function fetchRecent(
  mailbox: MailboxRow,
  password: string,
  batch: number,
): Promise<ParsedMail[]> {
  const client = new ImapFlow(imapOptions(mailbox, password));
  const parsed: ParsedMail[] = [];

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const total = typeof client.mailbox === "object" ? client.mailbox.exists : 0;
      if (total > 0) {
        const first = Math.max(1, total - batch + 1);
        for await (const message of client.fetch(`${first}:*`, { source: true })) {
          if (message.source) parsed.push(await simpleParser(message.source));
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  return parsed;
}

/** `true` quando a mensagem era nova; `false` quando já cá estava. */
async function storeMessage(
  client: MailWorkerClient,
  mailbox: MailboxRow,
  parsed: ParsedMail,
): Promise<boolean> {
  const messageId = parsed.messageId?.trim() || syntheticId(mailbox.id, parsed);

  const existing = await client
    .from("mail_messages")
    .select("id")
    .eq("mailbox_id", mailbox.id)
    .eq("message_id", messageId)
    .maybeSingle();

  if (existing.error) throw new Error(`Leitura de mail_messages falhou: ${existing.error.message}`);
  if (existing.data) return false;

  const sentAt = parsed.date ? parsed.date.toISOString() : null;
  const subject = parsed.subject?.trim() ?? "";
  const threadId = await ensureThread(client, mailbox, parsed, subject, sentAt);

  const row: Partial<MailMessageRow> & { mailbox_id: string; message_id: string } = {
    mailbox_id: mailbox.id,
    thread_id: threadId,
    message_id: messageId,
    in_reply_to: parsed.inReplyTo?.trim() || null,
    from_address: parsed.from?.value[0]?.address ?? "",
    from_name: parsed.from?.value[0]?.name ?? "",
    to_addresses: addresses(parsed.to),
    cc_addresses: addresses(parsed.cc),
    bcc_addresses: addresses(parsed.bcc),
    subject,
    html: typeof parsed.html === "string" ? parsed.html : null,
    text_body: parsed.text ?? null,
    folder: "inbox",
    attachments: parsed.attachments.map((file) => ({
      filename: file.filename ?? "anexo",
      contentType: file.contentType,
      size: file.size,
    })),
    sent_at: sentAt,
  };

  const { error } = await client.from("mail_messages").insert(row);

  // 23505 é o índice único a fazer o seu trabalho: outra passagem inseriu esta
  // mensagem entre a leitura e a escrita. Não é erro — é a idempotência.
  if (error && error.code !== "23505") {
    throw new Error(`Escrita em mail_messages falhou: ${error.message}`);
  }

  return !error;
}

/**
 * A conversa a que a mensagem pertence.
 *
 * `In-Reply-To` quando existe; o assunto normalizado quando não existe. Muitos
 * servidores e quase todos os formulários de contacto não enviam cabeçalhos de
 * referência, e sem a segunda via uma troca de seis e-mails aparecia como seis
 * conversas.
 */
async function ensureThread(
  client: MailWorkerClient,
  mailbox: MailboxRow,
  parsed: ParsedMail,
  subject: string,
  sentAt: string | null,
): Promise<string | null> {
  const key = parsed.inReplyTo?.trim() || normalizeSubject(subject) || parsed.messageId || "";
  if (!key) return null;

  const found = await client
    .from("mail_threads")
    .select("id, message_count")
    .eq("mailbox_id", mailbox.id)
    .eq("thread_key", key)
    .maybeSingle();

  if (found.error) throw new Error(`Leitura de mail_threads falhou: ${found.error.message}`);

  const lastMessageAt = sentAt ?? new Date().toISOString();

  if (found.data) {
    await client
      .from("mail_threads")
      .update({ last_message_at: lastMessageAt, message_count: found.data.message_count + 1 })
      .eq("id", found.data.id);
    return found.data.id;
  }

  const created = await client
    .from("mail_threads")
    .insert({
      mailbox_id: mailbox.id,
      thread_key: key,
      subject,
      last_message_at: lastMessageAt,
      message_count: 1,
    })
    .select("id")
    .maybeSingle();

  // Corrida com outra passagem: a conversa nasceu entretanto. Lê-se a que ficou.
  if (created.error?.code === "23505") {
    const retry = await client
      .from("mail_threads")
      .select("id")
      .eq("mailbox_id", mailbox.id)
      .eq("thread_key", key)
      .maybeSingle();
    return retry.data?.id ?? null;
  }

  if (created.error) throw new Error(`Escrita em mail_threads falhou: ${created.error.message}`);
  return created.data?.id ?? null;
}

function addresses(field: AddressObject | AddressObject[] | undefined): string[] {
  if (!field) return [];
  const list = Array.isArray(field) ? field : [field];
  return list.flatMap((entry) => entry.value.map((v) => v.address ?? "")).filter(Boolean);
}

/** `Re:`, `Fwd:`, `RE :` e companhia fora, e o resto em minúsculas. */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^((re|fw|fwd|enc|res)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Um `Message-ID` estável para servidores que não o enviam. Tem de dar sempre o
 * mesmo valor para a mesma mensagem — é o que impede a passagem seguinte de a
 * inserir outra vez.
 */
export function syntheticId(mailboxId: string, parsed: ParsedMail): string {
  const stamp = parsed.date ? parsed.date.toISOString() : "sem-data";
  const from = parsed.from?.value[0]?.address ?? "sem-remetente";
  const subject = normalizeSubject(parsed.subject ?? "");
  return `upm-${mailboxId}-${stamp}-${from}-${subject}`;
}
