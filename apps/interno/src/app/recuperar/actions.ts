"use server";

import { checkAuthRateLimit, emailSchema, recordAuthAttempt } from "@upm/db/auth";

import { sendRecoveryLink } from "../../lib/staff-access";

export type RecoverState = { sent?: boolean; error?: string };

/**
 * "Esqueci-me da palavra-passe" do interno — só para admins (8 nov 2026)
 * =========================================================================
 * O resto da equipa pede a um admin (Admin › Utilizadores). Aqui:
 *
 * - **A resposta é sempre a mesma**, seja o e-mail de um admin, de outra
 *   pessoa da equipa, de um cliente ou de ninguém. Só o envio muda. Quem
 *   experimente e-mails ao acaso não fica a saber quem é admin.
 * - **Limite de tentativas por e-mail**, o mesmo da recuperação do site.
 */
export async function requestAdminRecovery(
  _prev: RecoverState,
  formData: FormData,
): Promise<RecoverState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "E-mail inválido." };
  const email = parsed.data;

  const rateLimit = await checkAuthRateLimit(email, "password_recovery");
  if (!rateLimit.allowed) {
    return {
      error: `Demasiadas tentativas. Tente novamente dentro de ${rateLimit.retryAfterSeconds}s.`,
    };
  }

  const sent = await sendRecoveryLink(email, { onlyIfRole: ["admin"] });
  await recordAuthAttempt(email, "password_recovery", sent);

  return { sent: true };
}
