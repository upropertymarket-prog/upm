import { renderNotificationEmail, type DeliveryPayload } from "./notification-email.ts";

/**
 * A fila de saída — as regras, sem o transporte (7 nov 2026)
 * =========================================================================
 * Corre em dois sítios: na Edge Function `outbox` (o pré-lançamento, sem
 * alojamento para o `mail-worker`) e no próprio worker, quando for alojado
 * para o Suporte. Só o envio muda — a API do Resend por `fetch` num, o SDK
 * noutro —, e por isso entra por parâmetro. As regras ficam num sítio só.
 *
 * Sem dependências de Node nem de Deno: só TypeScript, para os dois a lerem.
 *
 * ## As regras (as do `outbox.ts` original, D27 · 08 §4.3)
 *
 * 1. **Marcar antes de enviar.** A linha passa a `sending` com a condição de
 *    corrida resolvida pela base (`eq("status", "queued")`): duas passagens ao
 *    mesmo tempo, só uma a leva.
 * 2. **Falhar com motivo e sem perder a entrega.** Um erro volta a `queued`
 *    com `attempts + 1` e `last_error`; à quinta fica `failed` e pára.
 * 3. **Não inventar remetentes** — é o transporte que sabe o `from`.
 *
 * ## E duas que a Edge Function pedia
 *
 * 4. **Uma entrega presa em `sending` volta à fila.** Se o processo morre entre
 *    marcar e enviar, a linha fica `sending` para sempre e o visitante nunca
 *    recebe a confirmação. Ao fim de 15 minutos sem mexer, volta a `queued`.
 * 5. **O id da entrega é a chave de idempotência do envio.** É o que torna a
 *    regra 4 segura: se o e-mail chegou a sair antes de o processo morrer, o
 *    Resend reconhece a chave e não o envia segunda vez.
 */

export const MAX_ATTEMPTS = 5;
const STUCK_AFTER_MINUTES = 15;

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** O id da entrega — ver a regra 5. */
  idempotencyKey: string;
};

/** Envia ou atira. Uma promessa resolvida é um e-mail aceite pelo relay. */
export type SendEmail = (email: OutboundEmail) => Promise<void>;

export type OutboxReport = { sent: number; failed: number; skipped: number; recovered: number };

/**
 * O cliente do Supabase, sem o tipo do pacote: este ficheiro é lido pelo Deno
 * (`npm:`/`jsr:`) e pelo Node (`node_modules`), e os dois tipos não são o
 * mesmo objeto para o compilador. As colunas usadas estão nas consultas de
 * baixo, e os testes do worker exercitam-nas.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OutboxDb = { from(table: "notification_deliveries"): any };

type Linha = { id: string; recipient: string; payload: unknown; attempts: number };

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}

export async function drainOutbox(
  db: OutboxDb,
  send: SendEmail,
  options: { batch: number; appUrl: string; siteUrl?: string; now?: Date },
): Promise<OutboxReport> {
  const report: OutboxReport = { sent: 0, failed: 0, skipped: 0, recovered: 0 };
  const now = options.now ?? new Date();

  // Regra 4.
  const limite = new Date(now.getTime() - STUCK_AFTER_MINUTES * 60_000).toISOString();
  const presas = await db
    .from("notification_deliveries")
    .update({ status: "queued" })
    .eq("status", "sending")
    .lt("updated_at", limite)
    .select("id");
  if (presas.error) throw new Error(`Não foi possível recuperar a fila: ${presas.error.message}`);
  report.recovered = Array.isArray(presas.data) ? presas.data.length : 0;

  const { data, error } = await db
    .from("notification_deliveries")
    .select("id, recipient, payload, attempts")
    .eq("status", "queued")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(options.batch);
  if (error) throw new Error(`Não foi possível ler a fila: ${error.message}`);

  for (const delivery of (data ?? []) as Linha[]) {
    // Regra 1.
    const claim = await db
      .from("notification_deliveries")
      .update({ status: "sending" })
      .eq("id", delivery.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (claim.error || !claim.data) {
      report.skipped += 1;
      continue;
    }

    const email = renderNotificationEmail(delivery.payload as DeliveryPayload, {
      appUrl: options.appUrl,
      siteUrl: options.siteUrl,
    });

    try {
      await send({
        to: delivery.recipient,
        subject: email.subject,
        html: email.html,
        text: email.text,
        idempotencyKey: delivery.id,
      });
      await db
        .from("notification_deliveries")
        .update({ status: "sent", sent_at: now.toISOString(), last_error: null })
        .eq("id", delivery.id);
      report.sent += 1;
    } catch (sendError) {
      // Regra 2.
      const attempts = delivery.attempts + 1;
      await db
        .from("notification_deliveries")
        .update({
          status: attempts >= MAX_ATTEMPTS ? "failed" : "queued",
          attempts,
          last_error: errorText(sendError).slice(0, 500),
        })
        .eq("id", delivery.id);
      report.failed += 1;
    }
  }

  return report;
}
