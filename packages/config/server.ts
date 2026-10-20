import { cookies } from "next/headers";
import { getRequestConfig, type GetRequestConfigParams } from "next-intl/server";

import { DEFAULT_LOCALE, INTL_LOCALE, LOCALE_COOKIE, resolveLocale, type Locale } from "./i18n";

/**
 * Configuração de pedido do `next-intl` — partilhada pelas 3 apps (P1-06)
 * =========================================================================
 * `timeZone` fixo em `Europe/Lisbon`: o produto é português e as horas das
 * visitas e dos envios agendados têm de ser as mesmas para as duas partes,
 * independentemente do fuso do browser de quem lê.
 *
 * ## Duas formas de descobrir o idioma, uma só configuração
 *
 * Até 20 out 2026 havia uma: o cookie `upm-locale`. Nessa altura o site
 * público passou a ter o idioma **no caminho** (`/en`, ver
 * `apps/web/src/i18n/routing.ts`), e as duas apps autenticadas continuaram no
 * cookie — porque ninguém procura `/painel` no Google e prefixar as rotas de
 * 03 §1 duplicava o inventário sem ganho.
 *
 * O que **não** se duplicou foi tudo o resto. O fuso, os formatos de número, o
 * tratamento de chave em falta e o carregamento das mensagens são os mesmos
 * nas três apps; a única diferença é de onde sai o `locale`. Daí o
 * `createRequestConfig`: recebe quem descobre o idioma e devolve o resto
 * igual. Com duas configurações copiadas, a próxima mudança ao fuso ou aos
 * formatos aplicava-se a uma e esquecia a outra.
 */
async function loadMessages(locale: Locale) {
  // Import dinâmico por locale: o bundle do servidor não carrega as duas.
  return locale === "en"
    ? (await import("./messages/en.json")).default
    : (await import("./messages/pt.json")).default;
}

/**
 * A configuração comum, parametrizada por quem resolve o idioma.
 *
 * O `apps/web` passa o `requestLocale` do `next-intl` (que lê o segmento
 * `[locale]` do caminho); o `app` e o `interno` não passam nada e ficam com o
 * cookie.
 */
export function createRequestConfig(
  resolverLocale?: (params: GetRequestConfigParams) => Promise<Locale>,
) {
  return getRequestConfig(async (params) => {
    const locale = resolverLocale ? await resolverLocale(params) : await localeDoCookie();

    return {
      locale,
      messages: await loadMessages(locale),
      timeZone: "Europe/Lisbon",
      formats: {
        number: {
          // 02 §12: moeda em EUR com as convenções de `pt-PT`.
          currency: { style: "currency", currency: "EUR" },
        },
      },
      onError() {
        // Uma chave em falta não deve rebentar a página. Quem apanha isso é o
        // teste de paridade em `messages.test.ts`, no CI, antes do deploy.
      },
      getMessageFallback({ key }) {
        return key;
      },
    };
  });
}

/** O idioma como as apps autenticadas o descobrem: no cookie `upm-locale`. */
async function localeDoCookie(): Promise<Locale> {
  const store = await cookies();
  return resolveLocale(store.get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE);
}

export default createRequestConfig();

export { INTL_LOCALE };
