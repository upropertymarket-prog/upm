"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";
import {
  checkAuthRateLimit,
  generateRecoveryCodes,
  hashPin,
  recordAuthAttempt,
  totpCodeSchema,
} from "@upm/db/auth";

/**
 * Ativação do 2FA TOTP obrigatório de `interno` (07 §6) — usa o MFA nativo do
 * Supabase Auth. Os códigos de recuperação são nossos (gerados aqui, hash em
 * `staff_auth.recovery_codes_hash`) porque o Supabase MFA não os fornece.
 */

export type VerifyEnrollmentState = {
  error?: string;
  success?: boolean;
  recoveryCodes?: string[];
};

export async function verifyEnrollment(
  _prev: VerifyEnrollmentState,
  formData: FormData,
): Promise<VerifyEnrollmentState> {
  const factorId = formData.get("factorId");
  const codeResult = totpCodeSchema.safeParse(formData.get("code"));
  if (typeof factorId !== "string" || !codeResult.success) {
    return { error: "Código inválido." };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const rateLimit = await checkAuthRateLimit(user.id, "totp_challenge");
  if (!rateLimit.allowed) {
    return {
      error: `Demasiadas tentativas. Tente novamente dentro de ${rateLimit.retryAfterSeconds}s.`,
    };
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeError || !challenge) {
    await recordAuthAttempt(user.id, "totp_challenge", false);
    return { error: "Não foi possível validar o código. Tente novamente." };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: codeResult.data,
  });
  await recordAuthAttempt(user.id, "totp_challenge", !verifyError);
  if (verifyError) return { error: "Código inválido." };

  const recoveryCodes = generateRecoveryCodes(10);
  const hashes = await Promise.all(recoveryCodes.map((code) => hashPin(code)));
  await supabase
    .from("staff_auth")
    .upsert({ profile_id: user.id, recovery_codes_hash: hashes }, { onConflict: "profile_id" });

  return { success: true, recoveryCodes };
}
