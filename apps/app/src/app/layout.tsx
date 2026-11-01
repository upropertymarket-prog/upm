import { headers } from "next/headers";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { BRAND_ICONS } from "@upm/config/brand";
import { NONCE_HEADER } from "@upm/config/security";
import { ThemeProvider, ThemeScript, ToastProvider } from "@upm/ui";
import { fontVariables } from "@upm/ui/fonts";

import { setThemePreference } from "./actions/preferences";
import { PendingGate } from "../components/PendingGate";
import { getServerThemeChoice } from "../lib/theme";
import { getPendingGateInfo } from "../lib/pending-gate";
import "./globals.css";

/**
 * `generateMetadata` e não um `metadata` constante, pela mesma razão que no
 * `apps/interno`: a descrição é texto que alguém lê — no separador do browser e
 * no histórico — e segue o idioma escolhido como o resto da app. Um `metadata`
 * constante é avaliado uma vez, fora de qualquer pedido, e não tem como saber
 * em que língua o utilizador está.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.app");
  return {
    title: t("title"),
    description: t("description"),
    icons: BRAND_ICONS,
  };
}

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
  const [locale, messages, themeChoice, requestHeaders, pendingGateInfo] = await Promise.all([
    getLocale(),
    getMessages(),
    getServerThemeChoice(),
    headers(),
    getPendingGateInfo(),
  ]);
  const nonce = requestHeaders.get(NONCE_HEADER) ?? undefined;

  return (
    <html lang={locale} data-app="app" className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript serverChoice={themeChoice} nonce={nonce} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider initialChoice={themeChoice ?? "system"} persist={setThemePreference}>
            <ToastProvider>
              <PendingGate info={pendingGateInfo} />
              {children}
            </ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
