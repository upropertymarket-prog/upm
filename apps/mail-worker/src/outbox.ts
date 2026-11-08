import { Resend } from "resend";

import {
  drainOutbox as drainWith,
  type OutboxReport as Report,
} from "../../../supabase/functions/_shared/outbox-core.ts";
import type { Env } from "./env.ts";
import type { MailWorkerClient } from "./supabase.ts";

/**
 * A fila de saída, pelo worker (D27 · 08 §4.3)
 * =========================================================================
 * As regras — marcar antes de enviar, cinco tentativas, recuperar o que ficou
 * preso, idempotência pelo id da entrega — estão em
 * `supabase/functions/_shared/outbox-core.ts` desde 7 nov 2026, partilhadas
 * com a Edge Function `outbox` que entrega a fila no pré-lançamento. Aqui fica
 * só o transporte: o SDK do Resend e o remetente.
 *
 * **Não correm os dois ao mesmo tempo.** Quando o worker for alojado (o
 * Suporte, no lançamento oficial), o agendamento `upm-drain-outbox` do
 * `pg_cron` desliga-se; mesmo que não se desligasse, a marcação da regra 1
 * impede que a mesma entrega saia duas vezes.
 */
export type OutboxReport = Report & { reason?: string };

export async function drainOutbox(
  client: MailWorkerClient,
  env: Env,
  options: { batch: number },
): Promise<OutboxReport> {
  if (!env.RESEND_API_KEY) {
    return {
      sent: 0,
      failed: 0,
      skipped: 0,
      recovered: 0,
      reason: "RESEND_API_KEY não está definida — a fila fica por drenar.",
    };
  }

  const resend = new Resend(env.RESEND_API_KEY);

  return drainWith(
    client,
    async (email) => {
      const sent = await resend.emails.send(
        {
          from: env.MAIL_FROM,
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text,
        },
        { idempotencyKey: email.idempotencyKey },
      );
      if (sent.error) throw new Error(sent.error.message);
    },
    { batch: options.batch, appUrl: env.APP_URL },
  );
}
