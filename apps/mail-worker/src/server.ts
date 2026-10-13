import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";

import { checkConnection, describe } from "./connection.ts";
import type { Env } from "./env.ts";
import { drainOutbox } from "./outbox.ts";
import { getMailbox, getMailboxPassword, type MailWorkerClient } from "./supabase.ts";
import { syncAllMailboxes } from "./sync.ts";

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

  if (!authorized(req, env)) {
    send(res, 401, { error: "Token em falta ou inválido." });
    return;
  }

  const testMatch = /^\/mailboxes\/([0-9a-f-]{36})\/test$/i.exec(path);
  if (req.method === "POST" && testMatch) {
    await handleTest(res, client, testMatch[1]!);
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
