import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { sendCampaignTest } from "./campaigns.ts";
import { checkConnection, describe } from "./connection.ts";
import type { Env } from "./env.ts";
import { drainOutbox } from "./outbox.ts";
import { recordResendEvent, verifyResendSignature } from "./receipts.ts";
import { sendMail } from "./send.ts";
import { getMailbox, getMailboxPassword, type MailWorkerClient } from "./supabase.ts";
import { syncAllMailboxes } from "./sync.ts";

/**
 * O corpo do `POST /send`, validado aqui e não lá dentro: o worker recebe JSON
 * de outro processo, e "outro processo" é entrada que se valida como qualquer
 * outra — mesmo quando o token já provou quem é.
 */
const sendSchema = z.object({
  mailboxId: z.string().uuid(),
  to: z.array(z.string().email()).min(1, "É preciso pelo menos um destinatário."),
  cc: z.array(z.string().email()).max(50).optional(),
  bcc: z.array(z.string().email()).max(50).optional(),
  subject: z.string().max(500),
  html: z.string().max(500_000),
  text: z.string().max(200_000).optional(),
  draftId: z.string().uuid().nullish(),
  inReplyTo: z.string().max(400).nullish(),
  fromName: z.string().max(200).optional(),
});

/**
 * O corpo do `POST /campaign-test`. O e-mail a testar identifica-se pelo seu
 * `id` e **não** pelos blocos: o que se testa tem de ser o que está guardado,
 * senão o teste prova uma coisa e o envio faz outra.
 */
const campaignTestSchema = z.object({
  campaignEmailId: z.string().uuid(),
  to: z.string().email(),
});

/** Com limite: um corpo sem fim é a forma mais simples de derrubar o worker. */
async function readRaw(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error("Corpo do pedido demasiado grande.");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const raw = await readRaw(req);
  return raw.length === 0 ? null : JSON.parse(raw);
}

/**
 * A porta do worker (P10-03)
 * =========================================================================
 * Quatro endpoints, todos atrás do mesmo token. É o que o Admin usa para o
 * "Testar ligação" de `/admin/caixas-email` e o que permite forçar uma
 * passagem sem esperar pelo intervalo.
 *
 *   GET  /health                  — vivo? (sem token, para o healthcheck do PaaS)
 *   POST /mailboxes/:id/test      — IMAP LOGIN + SMTP AUTH, resultado por ponta
 *   POST /sync                    — força uma sincronização de todas as caixas
 *   POST /outbox                  — força uma drenagem da fila de saída
 *   POST /send                    — entrega uma mensagem do composer do Suporte
 *   POST /campaign-test           — o "Enviar teste" do construtor de campanhas
 *   POST /resend-webhook          — os recibos do Resend (sem token: assinatura)
 *
 * **O token compara-se em tempo constante.** Uma comparação com `===` demora o
 * que demora o prefixo comum, e isso chega para adivinhar um token byte a byte
 * com pedidos suficientes. É a mesma razão por que `/health` é o único sem
 * token: responde sempre igual e não toca em nada.
 */

export function createWorkerServer(client: MailWorkerClient, env: Env) {
  return createServer((req, res) => {
    handle(req, res, client, env).catch((error) => {
      send(res, 500, { error: describe(error) });
    });
  });
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  client: MailWorkerClient,
  env: Env,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname.replace(/\/$/, "") || "/";

  if (req.method === "GET" && (path === "/health" || path === "/")) {
    send(res, 200, { ok: true, service: "mail-worker" });
    return;
  }

  /**
   * Os recibos do Resend (P10-09) ficam **antes** do guarda do token, e não é
   * um esquecimento: o Resend não sabe o nosso token e não tem como o saber. A
   * identidade dele é a **assinatura** do corpo, que `verifyResendSignature`
   * confere com o segredo partilhado — e sem segredo configurado recusa tudo.
   *
   * O corpo lê-se em bruto porque é sobre os bytes exatos que o HMAC é
   * calculado: um `JSON.parse` seguido de `JSON.stringify` muda o espaçamento e
   * a assinatura deixa de corresponder.
   */
  if (req.method === "POST" && path === "/resend-webhook") {
    const raw = await readRaw(req);
    const verificacao = verifyResendSignature(
      raw,
      {
        id: header(req, "svix-id"),
        timestamp: header(req, "svix-timestamp"),
        signature: header(req, "svix-signature"),
      },
      env.RESEND_WEBHOOK_SECRET,
    );

    if (!verificacao.ok) {
      send(res, 401, { error: verificacao.reason });
      return;
    }

    try {
      const report = await recordResendEvent(client, JSON.parse(raw));
      // 200 sempre que o recibo foi tratado — incluindo os ignorados. Um erro
      // aqui faz o Resend reentregar, e reentregar um evento que não nos
      // interessa é trabalho de graça para os dois lados.
      send(res, 200, report);
    } catch (error) {
      // Um 5xx é o que pede a reentrega, e é o que queremos quando a falha é
      // nossa: o recibo não se perde.
      send(res, 500, { error: describe(error) });
    }
    return;
  }

  if (!authorized(req, env)) {
    send(res, 401, { error: "Token em falta ou inválido." });
    return;
  }

  const testMatch = /^\/mailboxes\/([0-9a-f-]{36})\/test$/i.exec(path);
  if (req.method === "POST" && testMatch) {
    await handleTest(res, client, testMatch[1]!);
    return;
  }

  if (req.method === "POST" && path === "/send") {
    const body = await readJson(req);
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      send(res, 400, { error: parsed.error.issues[0]?.message ?? "Pedido inválido." });
      return;
    }
    try {
      const result = await sendMail(client, parsed.data);
      send(res, 200, result);
    } catch (error) {
      send(res, 502, { error: describe(error) });
    }
    return;
  }

  if (req.method === "POST" && path === "/sync") {
    const reports = await syncAllMailboxes(client, { batch: env.SYNC_BATCH });
    send(res, 200, { mailboxes: reports });
    return;
  }

  if (req.method === "POST" && path === "/outbox") {
    const report = await drainOutbox(client, env, { batch: env.OUTBOX_BATCH });
    send(res, 200, report);
    return;
  }

  /**
   * O "Enviar teste" do construtor de campanhas (P10-08 · 04 §2.6).
   *
   * Passa pelo worker e não pela app pela razão de sempre — só ele tem o
   * Resend — e **não** toca em `campaign_recipients`: um teste que criasse uma
   * linha de destinatário contava-se nas métricas da campanha e sujava o
   * alcance com os ensaios de quem a escreveu.
   */
  if (req.method === "POST" && path === "/campaign-test") {
    const body = await readJson(req);
    const parsed = campaignTestSchema.safeParse(body);
    if (!parsed.success) {
      send(res, 400, { error: parsed.error.issues[0]?.message ?? "Pedido inválido." });
      return;
    }
    try {
      await sendCampaignTest(client, env, parsed.data);
      send(res, 200, { ok: true });
    } catch (error) {
      send(res, 502, { error: describe(error) });
    }
    return;
  }

  send(res, 404, { error: "Endpoint desconhecido." });
}

async function handleTest(
  res: ServerResponse,
  client: MailWorkerClient,
  mailboxId: string,
): Promise<void> {
  const mailbox = await getMailbox(client, mailboxId);
  if (!mailbox) {
    send(res, 404, { error: "Caixa de e-mail inexistente." });
    return;
  }

  const password = await getMailboxPassword(client, mailboxId);
  if (!password) {
    send(res, 400, { error: "A caixa ainda não tem palavra-passe gravada." });
    return;
  }

  const result = await checkConnection(mailbox, password);
  send(res, 200, result);
}

/** Um cabeçalho, como string — o Node dá-os como `string | string[]`. */
function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function authorized(req: IncomingMessage, env: Env): boolean {
  const header = req.headers.authorization ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (presented.length !== env.MAIL_WORKER_TOKEN.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(env.MAIL_WORKER_TOKEN));
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}
