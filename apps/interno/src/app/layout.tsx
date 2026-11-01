import { headers } from "next/headers";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { BRAND_ICONS } from "@upm/config/brand";
import { NONCE_HEADER } from "@upm/config/security";
import { ThemeProvider, ThemeScript, ToastProvider } from "@upm/ui";
import { fontVariables } from "@upm/ui/fonts";

import { setThemePreference } from "./actions/preferences";
import { getServerThemeChoice } from "../lib/theme";
import "./globals.css";

/**
 * `generateMetadata` e não um `metadata` constante: o título e a descrição são
 * texto que alguém lê — no separador do browser e no histórico — e seguem o
 * idioma escolhido como o resto do painel. O `robots` é o único campo que não
 * muda com a língua.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.interno");
  return {
    title: t("title"),
    description: t("description"),
    // `noindex` em toda a área interna — 02 §3.1 e 07 §6.
    robots: { index: false, follow: false, nocache: true },
    icons: BRAND_ICONS,
  };
}

/**
 * Root layout de `interno.upropertymarket.pt` (P1-02 · P1-03 · P1-06)
 * =========================================================================
 * Igual ao de `app.*` — o shell e o design system são os mesmos (04 §5.5) —
 * mais o `noindex` obrigatório de 02 §3.1.
 *
 * A autenticação reforçada de `interno` (conta criada pelo admin, 2FA TOTP
 * obrigatório e PIN de operação como step-up) é da Fase 3, conforme 07 §6.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, messages, themeChoice, requestHeaders] = await Promise.all([
    getLocale(),
    getMessages(),
    getServerThemeChoice(),
    headers(),
  ]);
  const nonce = requestHeaders.get(NONCE_HEADER) ?? undefined;

  return (
    <html lang={locale} data-app="interno" className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript serverChoice={themeChoice} nonce={nonce} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider initialChoice={themeChoice ?? "system"} persist={setThemePreference}>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
