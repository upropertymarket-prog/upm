import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { INTL_LOCALE, resolveLocale } from "@upm/config";
import { NONCE_HEADER } from "@upm/config/security";
import { ThemeProvider, ThemeScript, ToastProvider } from "@upm/ui";
import { fontVariables } from "@upm/ui/fonts";

import { routing } from "@/i18n/routing";

import "../globals.css";

/**
 * As duas línguas são conhecidas em tempo de build, por isso declaram-se: é o
 * que permite ao Next pré-renderizar `/` e `/en` em vez de os servir sempre a
 * pedido.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * `generateMetadata` e não um `metadata` constante: a descrição é texto que
 * alguém lê, e segue o idioma escolhido como o resto do site. Uma constante é
 * avaliada fora de qualquer pedido e não tem como saber em que língua o
 * visitante está.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: resolveLocale(locale), namespace: "meta.web" });
  return {
    title: "UProperty Market",
    description: t("description"),
    // TODO: ícone final da marca (07 §10.1) — `icons` e o `og:image` por omissão
    // ficam por preencher até o cliente entregar o ícone. O SEO a sério entra na
    // Fase 5, com um `seo.ts` por rota (04 §8.1.2).
  };
}

/**
 * Root layout de `upropertymarket.pt` (P1-02 · P1-03 · P1-06)
 * =========================================================================
 * `data-app="web"` é o que sobe o mínimo tipográfico de 13 px para **14 px**
 * no site público (07 §3) — está em `tokens.css`, não aqui.
 *
 * Sem `profiles.theme`: não há sessão no `www`, logo o `ThemeScript` decide
 * entre `localStorage` e `prefers-color-scheme` (04 §5.2).
 *
 * ## O que o segmento `[locale]` trouxe (20 out 2026)
 *
 * O `setRequestLocale` tem de ser chamado **antes** de qualquer leitura de
 * mensagens, e é o que torna este layout estaticamente renderizável: sem ele, o
 * `next-intl` resolve o idioma a cada pedido e `/` e `/en` passavam a dinâmicos
 * sem necessidade.
 *
 * O `notFound()` no idioma inválido é a segunda metade da guarda do
 * `i18n/request.ts`. O segmento funciona como apanha-tudo, logo `/unknown.txt`
 * chega aqui com `"unknown.txt"` no `locale` — o `request.ts` já o fez cair em
 * português para não rebentar, e é **aqui** que se decide que aquilo não é uma
 * página: um 404, e não a home servida em `/unknown.txt`, que seria conteúdo
 * duplicado em tantos URL quantos alguém quisesse inventar.
 */
export default async function RootLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale: bruto } = await params;
  if (!hasLocale(routing.locales, bruto)) notFound();

  const locale = resolveLocale(bruto);
  setRequestLocale(locale);

  const [messages, requestHeaders] = await Promise.all([getMessages(), headers()]);
  const nonce = requestHeaders.get(NONCE_HEADER) ?? undefined;

  return (
    <html
      // `pt-PT` e `en-GB`, não `pt` e `en`: é o que o `INTL_LOCALE` já dizia
      // para as datas e a moeda, e o `lang` do documento tem de concordar com
      // elas — é por ele que o leitor de ecrã escolhe a pronúncia.
      lang={INTL_LOCALE[locale]}
      data-app="web"
      className={fontVariables}
      suppressHydrationWarning
    >
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
