import { createHmac, timingSafeEqual } from "node:crypto";

import type { MailWorkerClient } from "./supabase.ts";

/**
 * Os recibos do Resend (P10-09 · 05 §1.9)
 * =========================================================================
 * O webhook que diz o que aconteceu a cada e-mail: entregue, devolvido, aberto,
 * clicado, queixado. É o que enche `email_events` e, por ela, as métricas de
 * `campaigns`.
 *
 * ## Porque é que o webhook entra pelo worker e não por uma rota Next
 *
 * 02 §3.3 deixa a `service_role` em três sítios: Edge Functions, webhooks e o
 * mail-worker. Um webhook numa app Next **podia** — é o que o Stripe faz em
 * `apps/app/api/stripe/webhook`. A diferença que decide é outra: este webhook
 * fala do que **este processo** enviou, e é este processo que guarda o
 * `provider_message_id` que liga um recibo a um destinatário. Pôr as duas
 * metades da mesma conversa em processos diferentes é como se perde o fio.
 *
 * ## A assinatura verifica-se com `node:crypto` e sem dependência nova
 *
 * O Resend assina ao estilo Svix: três cabeçalhos (`svix-id`,
 * `svix-timestamp`, `svix-signature`) e um HMAC-SHA256 sobre
 * `${id}.${timestamp}.${corpo}`, com o segredo em base64 depois do prefixo
 * `whsec_`. São dez linhas — a biblioteca oficial traria uma árvore de
 * dependências para fazer um `createHmac`.
 *
 * **Sem segredo configurado, o webhook recusa tudo.** Não é "aceita enquanto
 * não houver segredo": um endpoint que escreve métricas a partir de qualquer
 * `POST` que lhe chegue é um endpoint que qualquer pessoa pode usar para
 * inventar aberturas. Falha de forma visível, como o `MAIL_FROM` por omissão.
 */

/** A tolerância de relógio, em segundos. Cinco minutos é o que o Svix usa. */
const TOLERANCIA = 300;

export type ReceiptVerification = { ok: true } | { ok: false; reason: string };

export function verifyResendSignature(
  raw: string,
  headers: { id?: string; timestamp?: string; signature?: string },
  secret: string | undefined,
): ReceiptVerification {
  if (!secret) return { ok: false, reason: "RESEND_WEBHOOK_SECRET não está definida." };
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return { ok: false, reason: "Faltam os cabeçalhos de assinatura." };
  }

  const segundos = Number(headers.timestamp);
  if (!Number.isFinite(segundos)) return { ok: false, reason: "Timestamp inválido." };
  if (Math.abs(Date.now() / 1000 - segundos) > TOLERANCIA) {
    // Um pedido antigo reenviado é um ataque de repetição: o corpo é válido e a
    // assinatura também, e sem esta janela contava a mesma abertura outra vez.
    return { ok: false, reason: "Pedido fora da janela de tolerância." };
  }

  const chave = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const esperada = createHmac("sha256", chave)
    .update(`${headers.id}.${headers.timestamp}.${raw}`)
    .digest("base64");

  /**
   * O cabeçalho traz uma ou mais assinaturas separadas por espaço, cada uma
   * como `v1,<base64>` — são mais do que uma durante uma rotação de segredo.
   * Basta **uma** válida, e a comparação é em tempo constante.
   */
  for (const parte of headers.signature.split(" ")) {
    const [versao, valor] = parte.split(",");
    if (versao !== "v1" || !valor) continue;
    const a = Buffer.from(valor, "base64");
    const b = Buffer.from(esperada, "base64");
    if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true };
  }

  return { ok: false, reason: "Assinatura não corresponde." };
}

/**
 * Os tipos do Resend → os tipos de `email_events`.
 *
 * `email.sent` **não** entra: é o aceite do provedor, e isso já está em
 * `campaign_recipients.status = 'sent'`, escrito por quem enviou. Registá-lo
 * aqui era guardar duas vezes a mesma coisa, uma delas sem acrescentar nada.
 *
 * `email.delivery_delayed` também não: é um estado intermédio que se resolve
 * sozinho para entregue ou devolvido, e um recibo que não é um desfecho não
 * pertence a uma tabela de desfechos.
 */
const TIPOS: Record<string, string> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.complained": "complained",
};

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    created_at?: string;
    click?: { link?: string };
  };
};

export type ReceiptReport = { recorded: number; ignored: number };

/**
 * Trata um evento e devolve o que fez.
 *
 * **Um destinatário por linha de evento**: o Resend manda `to` como lista, e um
 * envio em cópia gera um recibo com dois endereços. Cada um é uma pessoa com o
 * seu próprio desfecho — contar o evento só no primeiro era contá-lo na pessoa
 * errada, que é precisamente o que o índice único de `email_events` tem o
 * `recipient` para impedir.
 */
export async function recordResendEvent(
  client: MailWorkerClient,
  event: unknown,
): Promise<ReceiptReport> {
  const report: ReceiptReport = { recorded: 0, ignored: 0 };
  const parsed = event as ResendEvent;

  const tipo = parsed?.type ? TIPOS[parsed.type] : undefined;
  const messageRef = parsed?.data?.email_id;
  if (!tipo || !messageRef) {
    report.ignored += 1;
    return report;
  }

  const destinatarios = Array.isArray(parsed.data?.to)
    ? parsed.data!.to
    : parsed.data?.to
      ? [parsed.data.to]
      : [];

  if (destinatarios.length === 0) {
    report.ignored += 1;
    return report;
  }

  const quando = parsed.data?.created_at ?? parsed.created_at ?? null;

  for (const destinatario of destinatarios) {
    const { data, error } = await client.rpc("record_email_event", {
      p_message_ref: messageRef,
      p_recipient: destinatario,
      p_type: tipo,
      p_url: parsed.data?.click?.link ?? null,
      p_occurred_at: quando,
      // O corpo como veio, para quando a conta não bater.
      p_payload: parsed as unknown,
    });

    if (error) throw new Error(`Não foi possível registar o recibo: ${error.message}`);
    // `false` é uma reentrega do webhook — registada antes, e não se conta.
    if (data === true) report.recorded += 1;
    else report.ignored += 1;
  }

  return report;
}
