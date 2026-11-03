"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";
import {
  checkAuthRateLimit,
  consumeRecoveryCode,
  recordAuthAttempt,
  totpCodeSchema,
} from "@upm/db/auth";

import { RECOVERY_VERIFIED_COOKIE } from "../../lib/session";

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

export async function verifyRecoveryCode(
  _prev: ChallengeState,
  formData: FormData,
): Promise<ChallengeState> {
  const code = formData.get("recoveryCode");
  if (typeof code !== "string" || code.length === 0) return { error: "Código inválido." };

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const rateLimit = await checkAuthRateLimit(user.id, "pin_verify");
  if (!rateLimit.allowed) {
    return {
      error: `Demasiadas tentativas. Tente novamente dentro de ${rateLimit.retryAfterSeconds}s.`,
    };
  }

  const { data: staffAuth } = await supabase
    .from("staff_auth")
    .select("recovery_codes_hash")
    .eq("profile_id", user.id)
    .maybeSingle();

  const { matched, remaining } = await consumeRecoveryCode(
    code.trim().toUpperCase(),
    staffAuth?.recovery_codes_hash ?? [],
  );
  await recordAuthAttempt(user.id, "pin_verify", matched);
  if (!matched) return { error: "Código de recuperação inválido." };

  await supabase
    .from("staff_auth")
    .update({ recovery_codes_hash: remaining })
    .eq("profile_id", user.id);

  // Um código de recuperação não eleva o AAL nativo do Supabase (só o desafio
  // TOTP em si faz isso) — por isso o `middleware.ts` aceita, em alternativa,
  // este cookie assinado pelo servidor como prova de posse equivalente,
  // válido pelo resto da sessão (mesma janela de 8h de 07 §6).
  const store = await cookies();
  store.set(RECOVERY_VERIFIED_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });

  redirect("/");
}
