import { createSmtpTransport, describe } from "./connection.ts";
import { getMailbox, getMailboxPassword, type MailWorkerClient } from "./supabase.ts";

/**
 * Enviar pela caixa do Suporte (P10-05 · 02 §3.2)
 * =========================================================================
 * O composer de `/suporte/email` compõe; **quem entrega é este ficheiro**, pelo
 * SMTP da própria caixa (Amen), e não pelo Resend. Não é um detalhe de
 * infraestrutura — é o que faz a resposta sair de `suporte@upropertymarket.pt`
 * e ficar na conversa do cliente, em vez de chegar de um endereço de marketing
 * que ele nunca viu (07 §24.6).
 *
 * ## A ordem importa: enviar primeiro, registar depois
 *
 * `mail_record_sent()` só é chamada **depois** de o SMTP aceitar a mensagem, e
 * com o `messageId` que o servidor devolveu. Ao contrário, a caixa mostraria
 * como enviado aquilo que ficou pelo caminho — numa caixa de suporte, isso é
 * dizer a um cliente que lhe respondemos quando não respondemos.
 *
 * Se o SMTP aceitar e a escrita na base de dados falhar, o e-mail saiu na mesma
 * e o erro vai para quem pediu: é a troca certa. Reenviar para "corrigir" o
 * registo mandaria a mesma mensagem duas vezes à mesma pessoa.
 */

export type SendRequest = {
  mailboxId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  draftId?: string | null;
  inReplyTo?: string | null;
  fromName?: string;
};

export type SendResult = { id: string; messageId: string };

export async function sendMail(
  client: MailWorkerClient,
  request: SendRequest,
): Promise<SendResult> {
  const mailbox = await getMailbox(client, request.mailboxId);
  if (!mailbox) throw new Error("Caixa de e-mail inexistente.");
  if (mailbox.status === "paused") throw new Error("Esta caixa está em pausa.");

  const password = await getMailboxPassword(client, request.mailboxId);
  if (!password) throw new Error("A caixa não tem credencial gravada no Vault.");

  const transport = createSmtpTransport(mailbox, password);

  let messageId: string;
  try {
    const info = await transport.sendMail({
      from: {
        name: request.fromName || mailbox.display_name || mailbox.address,
        address: mailbox.address,
      },
      to: request.to,
      cc: request.cc?.length ? request.cc : undefined,
      bcc: request.bcc?.length ? request.bcc : undefined,
      subject: request.subject,
      html: request.html,
      text: request.text || stripHtml(request.html),
      inReplyTo: request.inReplyTo ?? undefined,
      references: request.inReplyTo ?? undefined,
    });
    messageId = info.messageId;
  } catch (error) {
    throw new Error(`O servidor de correio recusou a mensagem: ${describe(error)}`, {
      cause: error,
    });
  } finally {
    transport.close();
  }

  const { data, error } = await client.rpc("mail_record_sent", {
    p_mailbox_id: request.mailboxId,
    p_message_id: messageId,
    p_to: request.to,
    p_cc: request.cc ?? [],
    p_bcc: request.bcc ?? [],
    p_subject: request.subject,
    p_html: request.html,
    p_text: request.text ?? stripHtml(request.html),
    p_from_name: request.fromName ?? "",
    // `undefined` e não `null`, pela mesma razão do `receipts.ts`: são
    // opcionais na função SQL, o cliente omite o que vem `undefined`, e o
    // resultado no Postgres é o mesmo `NULL`. O `null` só compilava porque
    // estas funções não existiam no `database.types.ts`.
    p_draft_id: request.draftId ?? undefined,
    p_in_reply_to: request.inReplyTo ?? undefined,
  });

  if (error) {
    // A mensagem saiu. Dizer isto em voz alta é melhor do que um erro genérico
    // que levaria alguém a carregar em Enviar outra vez.
    throw new Error(`A mensagem foi enviada, mas não ficou registada na caixa: ${error.message}`);
  }

  return { id: String(data), messageId };
}

/** Versão em texto para quem lê sem HTML. Sem dependências: é o mínimo honesto. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
