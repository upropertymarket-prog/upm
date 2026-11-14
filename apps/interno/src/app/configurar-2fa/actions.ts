"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";
import { checkAuthRateLimit, recordAuthAttempt, totpCodeSchema } from "@upm/db/auth";

/**
 * Ativação do 2FA TOTP obrigatório de `interno` (07 §6) — usa o MFA nativo do
 * Supabase Auth. Sem códigos de recuperação desde 8 nov 2026 (decisão do
 * cliente): quem perde o telemóvel pede a um admin que lhe reponha a 2FA.
 */

export type VerifyEnrollmentState = { error?: string };

export type Enrollment =
  { factorId: string; qrCode: string; secret: string } | { error: "startFailed" };

/**
 * Cria o fator TOTP — chamada **uma vez**, pelo formulário, e nunca no render
 * da página (14 nov 2026). Até aqui a página apagava o fator por verificar e
 * criava outro a cada render; a resposta da Server Action de verificação volta
 * a desenhar a página (o Supabase escreve cookies), e o QR mudava por baixo da
 * pessoa: a app de autenticação ficava com o código de um fator que já não
 * existia, e nenhum código passava. Agora o QR vive no estado do formulário e
 * só muda se a pessoa recarregar a página.
 */
export async function startEnrollment(): Promise<Enrollment> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: existing } = await supabase.auth.mfa.listFactors();
  const totp = (existing?.all ?? []).filter((factor) => factor.factor_type === "totp");
  // Com 2FA já ativa não há nada a configurar (o middleware já desvia, isto é
  // só a segunda porta).
  if (totp.some((factor) => factor.status === "verified")) redirect("/");

  // Limpa os fatores **por verificar** de tentativas anteriores (QR expirado
  // sem terminar) — nunca há mais de um fator ativo por staff.
  for (const factor of totp.filter((factor) => factor.status === "unverified")) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  // `issuer` explícito (14 nov 2026): sem ele o Supabase usa o `site_url`, e a
  // entrada na app de autenticação chamava-se "localhost:3000". Com várias
  // tentativas ficavam várias entradas iguais, e a pessoa lia o código de uma
  // antiga — que o servidor recusava, com razão.
  const { data: enrollment, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "UProperty Market",
    friendlyName: user.email ?? undefined,
  });
  if (error || !enrollment) return { error: "startFailed" };
  return {
    factorId: enrollment.id,
    qrCode: enrollment.totp.qr_code,
    secret: enrollment.totp.secret,
  };
}

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

  redirect("/");
}
