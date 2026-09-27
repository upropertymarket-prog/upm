import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider, ThemeScript, ToastProvider } from "@upm/ui";
import { fontVariables } from "@upm/ui/fonts";

import { setThemePreference } from "./actions/preferences";
import { getServerThemeChoice } from "../lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "UProperty Market",
  description: "Área de comprador e proprietário.",
  // TODO: ícone final da marca (07 §10.1) — `icons` fica por preencher até o
  // cliente entregar o ícone. Nada de derivar um a partir do wordmark.
};

/**
 * Root layout de `app.upropertymarket.pt` (P1-02 · P1-03 · P1-06)
 * =========================================================================
 * Ordem que importa:
 *  1. `fontVariables` no `<html>` — declara `--font-bricolage`, `--font-manrope`
 *     e `--font-jetbrains`, que `tokens.css` consome;
 *  2. `<ThemeScript>` no `<head>`, síncrono, **antes** de qualquer outra coisa:
 *     é o que evita o clarão branco (04 §5.2);
 *  3. providers de i18n, tema e toasts a envolver a app.
 *
 * `suppressHydrationWarning` no `<html>` porque o script muda `data-theme`
 * antes da hidratação — a diferença é intencional.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, messages, themeChoice] = await Promise.all([
    getLocale(),
    getMessages(),
    getServerThemeChoice(),
  ]);

  return (
    <html lang={locale} data-app="app" className={fontVariables} suppressHydrationWarning>
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
