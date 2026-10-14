import type { Attachment } from "mailparser";

import {
  MAIL_ATTACHMENT_BUCKET,
  MAIL_ATTACHMENT_MAX_BYTES,
  MAIL_ATTACHMENT_MAX_FILES,
  MAIL_ATTACHMENT_MESSAGE_MAX_BYTES,
  mailAttachmentPath,
  resolveAttachmentMime,
  type MailAttachmentStored,
} from "@upm/db/mail-attachments";
import type { MailWorkerClient } from "./supabase.ts";

/**
 * Os bytes dos anexos (D66)
 * =========================================================================
 * O `simpleParser` já traz o conteúdo de cada anexo em memória — o IMAP
 * entregou a mensagem inteira, anexos incluídos, e o que faltava era **guardar**
 * o que já tínhamos em mão. Não há segunda ligação ao servidor de correio.
 *
 * ## A ordem: bytes primeiro, linha depois
 *
 * Os objetos sobem **antes** de `mail_messages` ser escrito, porque o caminho
 * de cada um entra na linha. Se o `insert` falhar — tipicamente por o índice
 * único dizer que outra passagem já inseriu esta mensagem — `discardUploads`
 * apaga o que subiu. O contrário (linha primeiro, bytes depois) deixava uma
 * lista a prometer ficheiros que podiam nunca chegar, e é essa a promessa
 * partida que D66 existia para não repetir.
 *
 * ## O que acontece a um anexo recusado
 *
 * **Fica na lista.** Com nome, tipo, tamanho e a razão por que não tem bytes:
 * `type` (fora da lista de 14 out), `size` (passa os 10 MB), `count` (é o 11.º
 * da mensagem, ou o teto de 25 MB chegou ao fim) ou `error` (a subida falhou).
 * Esconder o anexo era pior do que o botão desativado que havia antes: quem lê
 * deixava de saber que o cliente tinha anexado alguma coisa.
 */

export type AttachmentOutcome = {
  attachments: MailAttachmentStored[];
  /** Os caminhos que subiram — para os apagar se a mensagem não ficar. */
  uploaded: string[];
};

export async function storeAttachments(
  client: MailWorkerClient,
  mailboxId: string,
  messageId: string,
  files: Attachment[],
): Promise<AttachmentOutcome> {
  const attachments: MailAttachmentStored[] = [];
  const uploaded: string[] = [];
  let budget = MAIL_ATTACHMENT_MESSAGE_MAX_BYTES;

  for (const [index, file] of files.entries()) {
    const filename = file.filename?.trim() || "anexo";
    const size = file.size ?? file.content?.length ?? 0;
    const declared = file.contentType ?? "";
    const meta = { filename, contentType: declared, size };

    // Um `cid:` referenciado pelo HTML é parte do corpo, não um anexo que
    // alguém quis enviar: o logótipo da assinatura de quem escreveu apareceria
    // na lista a cada mensagem, e nenhuma das três ações faz sentido nele.
    if (file.related) continue;

    if (index >= MAIL_ATTACHMENT_MAX_FILES) {
      attachments.push({ ...meta, path: null, skipped: "count" });
      continue;
    }
    if (size > MAIL_ATTACHMENT_MAX_BYTES) {
      attachments.push({ ...meta, path: null, skipped: "size" });
      continue;
    }
    if (size > budget) {
      attachments.push({ ...meta, path: null, skipped: "count" });
      continue;
    }

    const bytes = toBytes(file.content);
    if (!bytes) {
      attachments.push({ ...meta, path: null, skipped: "error" });
      continue;
    }

    const mime = resolveAttachmentMime(declared, bytes);
    if (!mime) {
      attachments.push({ ...meta, path: null, skipped: "type" });
      continue;
    }

    const path = mailAttachmentPath(mailboxId, messageId, index, filename);
    const { error } = await client.storage.from(MAIL_ATTACHMENT_BUCKET).upload(path, bytes, {
      contentType: mime,
      // `true` e não `false`: uma passagem que morreu depois de subir o anexo e
      // antes de escrever a linha deixou o objeto lá. A seguinte reescreve-o
      // sobre si próprio — o caminho é determinístico — em vez de falhar por
      // um objeto que é, byte por byte, o que estava a tentar pôr.
      upsert: true,
    });

    if (error) {
      attachments.push({ ...meta, path: null, skipped: "error" });
      continue;
    }

    uploaded.push(path);
    budget -= size;
    // O tipo guardado é o **resolvido**, não o declarado: é o que o leitor usa
    // para decidir se o botão de imprimir serve, e tem de ser o mesmo com que o
    // objeto entrou no bucket.
    attachments.push({ filename, contentType: mime, size, path, skipped: null });
  }

  return { attachments, uploaded };
}

/** Depois de a mensagem não ficar, os objetos também não ficam. */
export async function discardUploads(client: MailWorkerClient, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await client.storage.from(MAIL_ATTACHMENT_BUCKET).remove(paths);
}

export type PurgeReport = { messages: number; objects: number; error?: string };

/**
 * A purga dos 180 dias (decisão do cliente, 14 out 2026)
 * =========================================================================
 * Corre aqui e não em `pg_cron` por uma razão técnica, não de gosto: apagar uma
 * linha de `storage.objects` **não apaga os bytes** — deixa-os órfãos no
 * backend. Quem apaga a sério é a API de Storage, e quem a alcança com
 * `service_role` é este processo (02 §3.3).
 *
 * A ordem é apagar primeiro e registar depois. Um caminho que fique no jsonb
 * depois de o objeto sair daria um botão a devolver 404; um objeto que fique no
 * bucket depois de o caminho sair é tentado outra vez na passagem seguinte, sem
 * mal nenhum.
 */
export async function purgeExpiredAttachments(
  client: MailWorkerClient,
  options: { batch: number },
): Promise<PurgeReport> {
  const report: PurgeReport = { messages: 0, objects: 0 };

  const { data, error } = await client.rpc("mail_attachments_expired", {
    p_limit: options.batch,
  });

  if (error) {
    report.error = `Não foi possível listar os anexos expirados: ${error.message}`;
    return report;
  }

  for (const row of data ?? []) {
    const paths = (row.paths ?? []).filter(Boolean);
    if (paths.length === 0) continue;

    const removal = await client.storage.from(MAIL_ATTACHMENT_BUCKET).remove(paths);
    if (removal.error) {
      report.error = `Não foi possível apagar os anexos: ${removal.error.message}`;
      return report;
    }

    const purged = await client.rpc("mail_attachment_purged", { p_message_id: row.message_id });
    if (purged.error) {
      report.error = `Não foi possível registar a purga: ${purged.error.message}`;
      return report;
    }

    report.messages += 1;
    report.objects += paths.length;
  }

  return report;
}

/**
 * O `content` do `mailparser` é um `Buffer`, mas o tipo deixa-o mais aberto do
 * que isso e uma mensagem malformada chega aqui com uma string. Converter em
 * vez de confiar é o que impede uma subida de um `[object Object]`.
 */
function toBytes(content: Attachment["content"]): Uint8Array | null {
  if (content instanceof Uint8Array) return content;
  if (typeof content === "string") return new TextEncoder().encode(content);
  return null;
}
