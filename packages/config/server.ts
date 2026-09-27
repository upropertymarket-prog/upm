import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, INTL_LOCALE, LOCALE_COOKIE, resolveLocale, type Locale } from "./i18n";

/**
 * Configuração de pedido do `next-intl` — partilhada pelas 3 apps (P1-06)
 * =========================================================================
 * Sem prefixo de locale no URL (ver `i18n.ts`): o idioma vem do cookie
 * `upm-locale`. Cada app tem um `src/i18n/request.ts` de uma linha que
 * reexporta isto, porque o plugin do `next-intl` exige um ficheiro dentro da
 * app — a lógica é só uma e vive aqui.
 *
 * `timeZone` fixo em `Europe/Lisbon`: o produto é português e as horas das
 * visitas e dos envios agendados têm de ser as mesmas para as duas partes,
 * independentemente do fuso do browser de quem lê.
 */
async function loadMessages(locale: Locale) {
  // Import dinâmico por locale: o bundle do servidor não carrega as duas.
  return locale === "en"
    ? (await import("./messages/en.json")).default
    : (await import("./messages/pt.json")).default;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE);

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

export { INTL_LOCALE };
