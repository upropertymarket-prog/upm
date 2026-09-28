"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient } from "@upm/db/server";
import { checkAuthRateLimit, emailSchema, recordAuthAttempt } from "@upm/db/auth";
import { LOCALE_COOKIE, isLocale } from "@upm/config";

import type { LoginState } from "./LoginForm";

export type { LoginState };

function clientIp(headerList: Headers): string {
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return headerList.get("x-real-ip") ?? "unknown";
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const emailResult = emailSchema.safeParse(formData.get("email"));
  const password = formData.get("password");
  const next = formData.get("next");

  // 08 §7.6 — mesma resposta para "e-mail não existe" e "password errada".
  const genericError = "Credenciais inválidas.";

  // Honeypot: campo invisível a humanos, os bots preenchem tudo (08 §7.6).
  if (
    typeof formData.get("website") === "string" &&
    (formData.get("website") as string).length > 0
  ) {
    return { error: genericError };
  }

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
  const limited = !byEmail.allowed || !byIp.allowed;
  if (limited) {
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
    .select("role, locale")
    .eq("id", data.user.id)
    .single();

  // 07 §6 — equipa nunca autentica pelo site público, só interno.*.
  if (profile?.role === "admin" || profile?.role === "support") {
    await supabase.auth.signOut();
    return { error: "Contas de equipa acedem em interno.upropertymarket.pt, não aqui." };
  }

  if (profile?.locale && isLocale(profile.locale)) {
    const store = await cookies();
    store.set(LOCALE_COOKIE, profile.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:4301";
  const safeNext = typeof next === "string" && next.startsWith("/") ? next : "/painel";
  // `redirect` com `typedRoutes` só aceita rotas internas conhecidas desta
  // app — um URL absoluto para `app.*` é, de propósito, outra coisa.
  redirect(`${appUrl}${safeNext}` as Route);
}
