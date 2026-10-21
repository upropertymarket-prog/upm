import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES } from "@upm/config";

import { pathnames } from "./pathnames";

/**
 * Encaminhamento por idioma — **só no site público** (20 out 2026)
 * =========================================================================
 * `www.upropertymarket.pt/en`, por decisão do cliente. É exatamente o que
 * `packages/config/i18n.ts` já previa quando decidiu não pôr prefixos em lado
 * nenhum: *"se aparecer, resolve-se com `/en` só em `apps/web`, sem tocar na
 * app autenticada"*.
 *
 * **E é só aqui.** O `app.*` e o `interno.*` continuam com o idioma no cookie,
 * e a razão é a de sempre: as rotas do produto estão inventariadas em 03 §1 e
 * prefixá-las duplicava o inventário sem ganho nenhum — ninguém procura
 * `/painel` no Google. O site público é o oposto: é o que se indexa, e aí um
 * URL por idioma não é preferência, é o que faz o Google tratar as duas
 * versões como traduções em vez de conteúdo duplicado.
 *
 * ## As três opções escolhidas, e porquê
 *
 * `localePrefix: "as-needed"` — o português não leva prefixo. **Nenhum URL que
 * já existe muda**, e é por isso que esta mudança não precisa de um único
 * redirect: `/termos` continua a ser `/termos`, e o inglês entra ao lado em
 * `/en/terms` — caminho traduzido incluído, ver `pathnames.ts`.
 *
 * `localeCookie: { name: LOCALE_COOKIE }` — o `next-intl` usa `NEXT_LOCALE`
 * por omissão, e o produto usa `upm-locale` desde P1-06. Deixá-los diferentes
 * dava **dois cookies de idioma a discordar**: quem escolhesse inglês no site
 * e seguisse para a app voltava a português, porque a app lê o outro. Com o
 * nome partilhado, a escolha viaja do site para a app.
 *
 * `localeDetection` fica ligado (por omissão): quem chega a `/` com o browser
 * em inglês vai para `/en`. É o comportamento que se espera de um site
 * bilingue, e o cookie passa a mandar a partir da primeira escolha explícita.
 */
/**
 * Os caminhos vivem em `pathnames.ts`, e re-exportam-se daqui porque é por
 * `@/i18n/routing` que o resto do site os importa desde que existem. A razão de
 * estarem noutro ficheiro está lá explicada: o `lib/seo.ts` tem de os ler, e
 * ler daqui arrastava o `next-intl` para dentro de um teste que corre em Node.
 */
export { pathnames } from "./pathnames";
export type { SitePathname, StaticSitePathname } from "./pathnames";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  localeCookie: { name: LOCALE_COOKIE },
  pathnames,
});
