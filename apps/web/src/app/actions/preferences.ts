"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@upm/config";

/**
 * Preferências do site público (P1-06)
 * =========================================================================
 * Só idioma: no `www` não há sessão, logo não há `profiles.theme` nem
 * `profiles.locale` onde gravar. O tema vive no `localStorage` do visitante,
 * escrito pelo `ThemeProvider` de `@upm/ui`.
 *
 * O cookie de idioma é estritamente necessário e isento de consentimento
 * (07 §4.4) — é por isso que não há banner de cookies na v1.
 */
export async function setLocalePreference(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
}
