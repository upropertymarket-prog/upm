"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";
import { checkAuthRateLimit, emailSchema, recordAuthAttempt } from "@upm/db/auth";

/**
 * Login de `interno` (07 §6) — só palavra-passe aqui. Sem registo público:
 * a conta é criada pelo admin (`scripts/create-staff-user.mjs`). O 2FA TOTP
 * (enrolment ou desafio) e os limites de sessão são o `middleware.ts` a
 * decidir para onde redirecionar depois deste login.
 */

export type LoginState = { error?: string };

function clientIp(headerList: Headers): string {
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return headerList.get("x-real-ip") ?? "unknown";
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const emailResult = emailSchema.safeParse(formData.get("email"));
  const password = formData.get("password");
  const genericError = "Credenciais inválidas.";

  if (!emailResult.success || typeof password !== "string" || password.length === 0) {
    return { error: genericError };
  }
  const email = emailResult.data;

  const headerList = await headers();
  const ip = clientIp(headerList);
  const supabase = createClient(await cookies());

  const [byEmail, byIp] = await Promise.all([
    checkAuthRateLimit(supabase, email, "login"),
    checkAuthRateLimit(supabase, ip, "login"),
  ]);
  if (!byEmail.allowed || !byIp.allowed) {
    const wait = Math.max(byEmail.retryAfterSeconds, byIp.retryAfterSeconds);
    return { error: `Demasiadas tentativas. Tente novamente dentro de ${wait}s.` };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  await Promise.all([
    recordAuthAttempt(supabase, email, "login", !error),
    recordAuthAttempt(supabase, ip, "login", !error),
  ]);
  if (error || !data.user) return { error: genericError };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "support") {
    await supabase.auth.signOut();
    return { error: genericError };
  }

  redirect("/");
}
