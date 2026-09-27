"use server";

import { cookies } from "next/headers";
import { createClient } from "@upm/db/server";
import { LOCALE_COOKIE, isLocale } from "@upm/config";
import { isThemeChoice, type ThemeChoice } from "@upm/ui";

/**
 * Preferências de apresentação — tema e idioma (P1-03 · P1-06)
 * =========================================================================
 * Duas Server Actions, ambas com validação de input no servidor (08 §3.2 e
 * §7.8): o valor vem do cliente e não se confia nele. Não há `zod` aqui porque
 * o domínio é uma lista fechada de três e duas strings — os próprios `is*` são
 * a validação, e são os mesmos que a migração impõe no `check` da coluna.
 *
 * Não são ações sensíveis: não entram no `audit_log` (08 §6.7 lista o que
 * entra, e preferências de tema não estão lá).
 */

/**
 * Grava o tema escolhido em `profiles.theme` (04 §5.2).
 *
 * Sem sessão não faz nada e não é erro: o `localStorage` do cliente já guardou
 * a escolha, e o visitante anónimo não tem perfil onde a pôr. A RLS de
 * `profiles_update_own` é a segunda camada — o `eq("id", user.id)` explícito é
 * a primeira (08 §7.3: posse validada nas duas).
 */
export async function setThemePreference(choice: ThemeChoice): Promise<void> {
  if (!isThemeChoice(choice)) return;

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ theme: choice }).eq("id", user.id);
}

/**
 * Grava o idioma no cookie lido por `@upm/config/server` e, havendo sessão,
 * também em `profiles.locale`.
 *
 * O cookie é a fonte que o servidor lê: o idioma tem de funcionar antes de
 * haver sessão (ecrã de login, site público) e tem de estar decidido no
 * primeiro render, antes de qualquer query. É estritamente necessário e isento
 * de consentimento (07 §4.4).
 *
 * A coluna serve para a preferência seguir a conta entre dispositivos. Quem a
 * transforma em cookie é o login, na Fase 3 (03 F3) — aqui só se mantém os dois
 * lados sincronizados.
 */
export async function setLocalePreference(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    // Legível pelo cliente de propósito: não é um segredo e o seletor de idioma
    // precisa de saber o valor atual sem uma ida ao servidor.
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  const supabase = createClient(store);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ locale }).eq("id", user.id);
}
