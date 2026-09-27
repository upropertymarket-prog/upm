import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider, ThemeScript, ToastProvider } from "@upm/ui";
import { fontVariables } from "@upm/ui/fonts";

import { setThemePreference } from "./actions/preferences";
import { getServerThemeChoice } from "../lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "UProperty Market · Interno",
  description: "Área interna de Administração e Suporte.",
  // `noindex` em toda a área interna — 02 §3.1 e 07 §6.
  robots: { index: false, follow: false, nocache: true },
  // TODO: ícone final da marca (07 §10.1).
};

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
  const [locale, messages, themeChoice] = await Promise.all([
    getLocale(),
    getMessages(),
    getServerThemeChoice(),
  ]);

  return (
    <html lang={locale} data-app="interno" className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript serverChoice={themeChoice} />
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
