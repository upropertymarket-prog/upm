"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";
import { isPasswordPwned, passwordSchema } from "@upm/db/auth";

import { SESSION_COOKIES } from "../../lib/session";
import { setPasswordFromRecoverySession } from "../../lib/staff-access";

export type NewPasswordState = { error?: string };

/**
 * Define a palavra-passe nova, a partir da sessão do link de recuperação.
 *
 * **Termina a sessão no fim.** A sessão do link é `aal1` e serviu só para
 * isto; a pessoa volta ao ecrã de entrada e entra como sempre — palavra-passe
 * nova e o código da app. Mantê-la aberta não daria acesso a nada (o
 * middleware pede o código), mas deixava uma sessão viva sem razão.
 */
export async function setStaffPassword(
  _prev: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { error: "Mínimo 10 caracteres." };
  const password = parsed.data;

  if (await isPasswordPwned(password)) {
    return { error: "Esta palavra-passe apareceu em fugas de dados conhecidas. Escolha outra." };
  }

  const store = await cookies();
  const supabase = createClient(store);
  // As claims dizem como a sessão nasceu: só a de um link de recuperação
  // serve (ver `setPasswordFromRecoverySession`).
  const { data } = await supabase.auth.getClaims();
  const result = await setPasswordFromRecoverySession(data?.claims, password);
  if (result === "not_recovery") redirect("/entrar?erro=link_invalido");
  if (result === "failed") {
    return { error: "Não foi possível guardar a palavra-passe. Peça um novo link." };
  }

  await supabase.auth.signOut();
  for (const name of SESSION_COOKIES) store.delete(name);
  redirect("/entrar?aviso=palavra_passe_definida");
}
