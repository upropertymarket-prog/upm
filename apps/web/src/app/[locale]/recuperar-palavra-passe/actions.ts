"use server";

import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { createClient } from "@upm/db/server";
import {
  checkAuthRateLimit,
  emailSchema,
  isPasswordPwned,
  passwordSchema,
  recordAuthAttempt,
} from "@upm/db/auth";

import type { RequestRecoveryState } from "./RequestForm";
import type { SetNewPasswordState } from "./confirmar/NewPasswordForm";

export type { RequestRecoveryState, SetNewPasswordState };

export async function requestPasswordReset(
  _prev: RequestRecoveryState,
  formData: FormData,
): Promise<RequestRecoveryState> {
  const emailResult = emailSchema.safeParse(formData.get("email"));
  if (!emailResult.success) return { error: "E-mail inválido." };
  const email = emailResult.data;

  const supabase = createClient(await cookies());
  const rateLimit = await checkAuthRateLimit(email, "password_recovery");
  if (!rateLimit.allowed) {
    return {
      error: `Demasiadas tentativas. Tente novamente dentro de ${rateLimit.retryAfterSeconds}s.`,
    };
  }

  const webUrl = process.env.WEB_URL ?? "http://localhost:4300";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${webUrl}/auth/confirm?next=${encodeURIComponent("/recuperar-palavra-passe/confirmar")}`,
  });
  await recordAuthAttempt(email, "password_recovery", !error);

  // 08 §7.6 — nunca revelar se o e-mail existe: resposta sempre igual.
  return { sent: true };
}

export async function setNewPassword(
  _prev: SetNewPasswordState,
  formData: FormData,
): Promise<SetNewPasswordState> {
  const passwordResult = passwordSchema.safeParse(formData.get("password"));
  if (!passwordResult.success) return { error: "Mínimo 10 caracteres." };
  const password = passwordResult.data;

  if (await isPasswordPwned(password)) {
    return { error: "Esta palavra-passe apareceu em fugas de dados conhecidas. Escolha outra." };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Não foi possível guardar a nova palavra-passe. Peça um novo link." };

  // O `redirect` do `next-intl` leva o idioma: de `/en/reset-password`
  // volta-se para `/en/sign-in`, e não para a versão portuguesa.
  // `return` e não só a chamada: o `redirect` devolve `never`, mas o TS perde
  // essa informação pelo destructuring genérico do `createNavigation` e passa
  // a dizer que a função não tem retorno. O `return` diz as duas coisas ao
  // mesmo tempo — ao compilador e a quem lê que aqui termina.
  return redirect({
    href: { pathname: "/entrar", query: { aviso: "password_definida" } },
    locale: await getLocale(),
  });
}
