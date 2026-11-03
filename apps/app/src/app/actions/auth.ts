"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient } from "@upm/db/server";
import { checkAuthRateLimit, emailSchema, recordAuthAttempt } from "@upm/db/auth";

/**
 * Ações da conta `pending` (07 §5.9) e sessão. Reenviar/alterar e-mail
 * reabrem a janela de verificação; sair encerra a sessão e volta a `www`.
 */

export type ResendState = { sent?: boolean; error?: string };

// `useActionState` chama com (estado, formData); esta ação não precisa de
// nenhum dos dois — lê tudo da sessão. TS aceita a assinatura mais curta.
export async function resendVerificationEmail(): Promise<ResendState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Sessão inválida." };

  const rateLimit = await checkAuthRateLimit(user.email, "resend_verification");
  if (!rateLimit.allowed) {
    return {
      error: `Demasiadas tentativas. Tente novamente dentro de ${rateLimit.retryAfterSeconds}s.`,
    };
  }

  const webUrl = process.env.WEB_URL ?? "http://localhost:4300";
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
    options: {
      emailRedirectTo: `${webUrl}/auth/confirm?next=${encodeURIComponent("/painel")}`,
    },
  });
  await recordAuthAttempt(user.email, "resend_verification", !error);

  if (error) return { error: "Não foi possível reenviar o e-mail. Tente novamente." };
  return { sent: true };
}

export type ChangeEmailState = { error?: string; sent?: boolean };

export async function changeEmail(
  _prev: ChangeEmailState,
  formData: FormData,
): Promise<ChangeEmailState> {
  const emailResult = emailSchema.safeParse(formData.get("email"));
  if (!emailResult.success) return { error: "E-mail inválido." };

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const webUrl = process.env.WEB_URL ?? "http://localhost:4300";
  const { error } = await supabase.auth.updateUser(
    { email: emailResult.data },
    { emailRedirectTo: `${webUrl}/auth/confirm?next=${encodeURIComponent("/painel")}` },
  );
  if (error) return { error: "Não foi possível alterar o e-mail. Tente novamente." };

  // Novo e-mail, nova janela de cortesia (07 §5.9) — só para contas ainda pending.
  await supabase
    .from("profiles")
    .update({
      verification_grace_until: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", user.id)
    .eq("status", "pending");

  return { sent: true };
}

export async function signOut(): Promise<void> {
  const supabase = createClient(await cookies());
  await supabase.auth.signOut();
  const webUrl = process.env.WEB_URL ?? "http://localhost:4300";
  // `redirect` com `typedRoutes` só aceita rotas internas conhecidas desta
  // app — um URL absoluto para `www` é, de propósito, outra coisa.
  redirect(`${webUrl}/entrar` as Route);
}
