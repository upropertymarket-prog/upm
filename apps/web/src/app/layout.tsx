import { headers } from "next/headers";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { NONCE_HEADER } from "@upm/config/security";
import { ThemeProvider, ThemeScript, ToastProvider } from "@upm/ui";
import { fontVariables } from "@upm/ui/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: "UProperty Market",
  description: "Compre, venda e arrende imóveis diretamente, sem comissões.",
  // TODO: ícone final da marca (07 §10.1) — `icons` e o `og:image` por omissão
  // ficam por preencher até o cliente entregar o ícone. O SEO a sério entra na
  // Fase 5, com um `seo.ts` por rota (04 §8.1.2).
};

/**
 * Root layout de `upropertymarket.pt` (P1-02 · P1-03 · P1-06)
 * =========================================================================
 * `data-app="web"` é o que sobe o mínimo tipográfico de 13 px para **14 px**
 * no site público (07 §3) — está em `tokens.css`, não aqui.
 *
 * Sem `profiles.theme`: não há sessão no `www`, logo o `ThemeScript` decide
 * entre `localStorage` e `prefers-color-scheme` (04 §5.2).
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, messages, requestHeaders] = await Promise.all([
    getLocale(),
    getMessages(),
    headers(),
  ]);
  const nonce = requestHeaders.get(NONCE_HEADER) ?? undefined;

  return (
    <html lang={locale} data-app="web" className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript nonce={nonce} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
