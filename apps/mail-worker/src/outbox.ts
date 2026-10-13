import { Resend } from "resend";

import { describe } from "./connection.ts";
import type { Env } from "./env.ts";
import type { MailWorkerClient } from "./supabase.ts";
import { renderNotificationEmail, type DeliveryPayload } from "./templates.ts";

/**
 * A fila de saída (D27 · 08 §4.3)
 * =========================================================================
 * `notification_deliveries` recebe entregas desde a Fase 5 e **nunca ninguém a
 * esvaziou** — é a dívida D27 na sua forma literal: e-mails que o produto
 * promete e não envia. Esta é a peça que faltava.
 *
 * ## Três regras que o envio tem de cumprir
 *
 * 1. **Marcar antes de enviar.** A linha passa a `sending` com uma condição de
 *    corrida resolvida pela própria base de dados (`eq("status", "queued")`):
 *    se duas passagens tentarem a mesma entrega, só uma a leva. O contrário —
 *    enviar e depois marcar — duplica o e-mail sempre que o processo morre no
 *    meio, e um aviso de visita duplicado é uma chamada ao suporte.
 * 2. **Falhar com motivo e sem perder a entrega.** Um erro volta a `queued` com
 *    `attempts + 1` e `last_error`. Ao fim de cinco tentativas fica `failed` e
 *    pára, porque uma fila que tenta para sempre um endereço inexistente
 *    bloqueia-se a si própria e queima reputação de envio.
 * 3. **Não inventar remetentes.** O `from` é `MAIL_FROM`, e enquanto o domínio
 *    não estiver verificado no Resend é `onboarding@resend.dev` — que só
 *    entrega ao e-mail da conta (07 §24.2). É pouco, mas é verdade; um envio
 *    que parece sair e não chega é pior do que um erro visível.
 */

const MAX_ATTEMPTS = 5;

export type OutboxReport = { sent: number; failed: number; skipped: number; reason?: string };

export async function drainOutbox(
  client: MailWorkerClient,
  env: Env,
  options: { batch: number },
): Promise<OutboxReport> {
  const report: OutboxReport = { sent: 0, failed: 0, skipped: 0 };

  if (!env.RESEND_API_KEY) {
    report.reason = "RESEND_API_KEY não está definida — a fila fica por drenar.";
    return report;
  }

  const resend = new Resend(env.RESEND_API_KEY);

  const { data, error } = await client
    .from("notification_deliveries")
    .select("id, recipient, payload, attempts")
    .eq("status", "queued")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(options.batch);

  if (error) throw new Error(`Não foi possível ler a fila: ${error.message}`);

  for (const delivery of data ?? []) {
    // Marcar primeiro — ver a regra 1 na nota de topo.
    const claim = await client
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
      appUrl: env.APP_URL,
    });

    try {
      const sent = await resend.emails.send({
        from: env.MAIL_FROM,
        to: delivery.recipient,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      if (sent.error) throw new Error(sent.error.message);

      await client
        .from("notification_deliveries")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", delivery.id);

      report.sent += 1;
    } catch (sendError) {
      const attempts = delivery.attempts + 1;
      await client
        .from("notification_deliveries")
        .update({
          status: attempts >= MAX_ATTEMPTS ? "failed" : "queued",
          attempts,
          last_error: describe(sendError).slice(0, 500),
        })
        .eq("id", delivery.id);

      report.failed += 1;
    }
  }

  return report;
}
