"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";
import { checkAuthRateLimit, recordAuthAttempt, totpCodeSchema } from "@upm/db/auth";

export type ChallengeState = { error?: string };

export async function verifyChallenge(
  _prev: ChallengeState,
  formData: FormData,
): Promise<ChallengeState> {
  const factorId = formData.get("factorId");
  const codeResult = totpCodeSchema.safeParse(formData.get("code"));
  if (typeof factorId !== "string" || !codeResult.success) return { error: "Código inválido." };

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
    return { error: "Código inválido." };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: codeResult.data,
  });
  await recordAuthAttempt(user.id, "totp_challenge", !verifyError);
  if (verifyError) return { error: "Código inválido." };

  redirect("/");
}
