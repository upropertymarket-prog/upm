import { hasLocale } from "next-intl";
import { DEFAULT_LOCALE, type Locale } from "@upm/config";
import { createRequestConfig } from "@upm/config/server";

import { routing } from "./routing";

/**
 * O plugin do `next-intl` exige este ficheiro dentro da app.
 *
 * Nas outras duas apps é uma linha que reexporta `@upm/config/server`. Aqui
 * não pode ser: o site público tem o idioma **no caminho** desde 20 out 2026
 * (`/en`), e é o `requestLocale` que o lê do segmento `[locale]`. Tudo o resto
 * — fuso, formatos, chave em falta, carregamento das mensagens — continua a ser
 * o mesmo das outras apps e vem do `createRequestConfig`, em vez de ser
 * copiado para aqui.
 *
 * O `hasLocale` é a guarda que o `next-intl` recomenda, e não é teórica: o
 * segmento `[locale]` funciona como apanha-tudo, por isso um pedido a
 * `/unknown.txt` chega aqui com `"unknown.txt"` no lugar do idioma. Sem a
 * verificação, ficava a tentar carregar mensagens de um idioma que não existe.
 * Cai na língua-fonte e deixa o `[locale]/not-found.tsx` dar o 404 — que é o
 * que esse pedido merece.
 */
export default createRequestConfig(async ({ requestLocale }) => {
  const pedido = await requestLocale;
  return hasLocale(routing.locales, pedido) ? (pedido as Locale) : DEFAULT_LOCALE;
});
