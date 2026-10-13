import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

import type { MailboxRow } from "./supabase.ts";

/**
 * Como se fala com o servidor da caixa (02 §3.2)
 * =========================================================================
 * Um sítio só a traduzir as colunas de `mailboxes` para opções de ligação —
 * `imapflow` de um lado, `nodemailer` do outro. Com a tradução espalhada, o dia
 * em que uma caixa precisar de `starttls` na entrada e `ssl_tls` na saída dá um
 * erro de autenticação que ninguém liga à configuração.
 *
 * **`mail_security` fala de TLS, não de porta.** `ssl_tls` é TLS desde o
 * primeiro byte (993/465); `starttls` começa em claro e sobe (143/587); `none`
 * não cifra — o ecrã desaconselha-o e esta camada não o proíbe, porque há
 * servidores antigos que ainda o exigem. O que não se faz em caso nenhum é
 * desligar a verificação do certificado: um worker que aceita qualquer
 * certificado é um worker que entrega as credenciais a quem se puser no meio.
 */

export type ImapOptions = ConstructorParameters<typeof ImapFlow>[0];

export function imapOptions(mailbox: MailboxRow, password: string): ImapOptions {
  return {
    host: mailbox.in_host,
    port: mailbox.in_port,
    secure: mailbox.in_security === "ssl_tls",
    auth: { user: mailbox.username, pass: password },
    // O log do imapflow é verboso e inclui os comandos de autenticação. Fica
    // calado, e o que interessa sai pelo nosso próprio registo.
    logger: false,
    ...(mailbox.in_security === "starttls" ? { requireTLS: true } : {}),
  } satisfies ImapOptions;
}

export function createSmtpTransport(mailbox: MailboxRow, password: string) {
  return nodemailer.createTransport({
    host: mailbox.smtp_host,
    port: mailbox.smtp_port,
    secure: mailbox.smtp_security === "ssl_tls",
    requireTLS: mailbox.smtp_security === "starttls",
    auth: { user: mailbox.username, pass: password },
  });
}

export type ConnectionCheck = {
  imap: { ok: boolean; error?: string };
  smtp: { ok: boolean; error?: string };
};

/**
 * O "Testar ligação" de 04 §2.5, feito a sério: um `LOGIN` de IMAP e um
 * `EHLO`+`AUTH` de SMTP.
 *
 * **As duas pontas testam-se separadamente e o resultado diz qual falhou.** Um
 * "não foi possível ligar" sem dizer de que lado manda quem está a configurar
 * verificar seis campos quando um está errado — e, na prática, o que falha
 * quase sempre é a porta de saída.
 *
 * `POP3` não tem teste próprio: `node-pop3` entra com a sincronização por POP3,
 * e até lá uma caixa `pop3` testa só o SMTP e diz-se que a entrada não foi
 * testada. Prometer verde a uma coisa que não se verificou é pior do que não a
 * verificar.
 */
export async function checkConnection(
  mailbox: MailboxRow,
  password: string,
): Promise<ConnectionCheck> {
  const result: ConnectionCheck = { imap: { ok: false }, smtp: { ok: false } };

  if (mailbox.protocol === "imap") {
    const client = new ImapFlow(imapOptions(mailbox, password));
    try {
      await client.connect();
      result.imap = { ok: true };
    } catch (error) {
      result.imap = { ok: false, error: describe(error) };
    } finally {
      await client.logout().catch(() => undefined);
    }
  } else {
    result.imap = { ok: false, error: "POP3 ainda não é testado pelo worker." };
  }

  const transport = createSmtpTransport(mailbox, password);
  try {
    await transport.verify();
    result.smtp = { ok: true };
  } catch (error) {
    result.smtp = { ok: false, error: describe(error) };
  } finally {
    transport.close();
  }

  return result;
}

/**
 * A mensagem de um erro de protocolo, sem o objeto à volta.
 *
 * Nunca `JSON.stringify(error)`: os erros do `nodemailer` trazem as opções de
 * ligação — **com a palavra-passe lá dentro** — e essa mensagem vai parar a
 * `mailboxes.last_error`, que o ecrã do Admin mostra.
 */
export function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Erro desconhecido na ligação ao servidor de correio.";
}
