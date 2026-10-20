import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES } from "@upm/config";

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
 * `/en/termos`.
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
 * Os caminhos do site, declarados — **e iguais nos dois idiomas**.
 *
 * O `next-intl` deixa traduzir o próprio caminho (`/termos` ↔ `/terms`). Não se
 * faz, e por duas razões: os URL portugueses estão inventariados em 03 §1 e
 * traduzi-los duplicava o inventário; e o que se ganha é nada — ninguém procura
 * "terms" para chegar aos nossos termos.
 *
 * A lista existe por outro motivo, e esse é concreto: **sem ela o `href` do
 * `Link` passa a ser uma `string` qualquer**. O `typedRoutes` do Next deixa de
 * servir aqui (o union dele passou a ser `/[locale]/termos`), e o
 * `AuthShell.switchHref` tinha escrito, com razão, *"uma rota conhecida, não
 * uma string qualquer"*. Com os `pathnames`, quem escrever `/entar` leva um
 * erro de compilação em vez de um 404 em produção.
 */
export const pathnames = {
  "/": "/",
  "/propriedades": "/propriedades",
  "/propriedades/[slug]": "/propriedades/[slug]",
  "/termos": "/termos",
  "/privacidade": "/privacidade",
  "/cookies": "/cookies",
  "/pre-inscricao": "/pre-inscricao",
  "/criar-conta": "/criar-conta",
  "/criar-conta/verificacao": "/criar-conta/verificacao",
  "/entrar": "/entrar",
  "/recuperar-palavra-passe": "/recuperar-palavra-passe",
  "/recuperar-palavra-passe/confirmar": "/recuperar-palavra-passe/confirmar",
  "/cancelar-subscricao": "/cancelar-subscricao",
} as const;

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  localeCookie: { name: LOCALE_COOKIE },
  pathnames,
});

/** Um caminho do site, incluindo os que têm segmento dinâmico. */
export type SitePathname = keyof typeof pathnames;

/**
 * Só os caminhos estáticos.
 *
 * Um `href` em string não serve para `/propriedades/[slug]` — esse precisa de
 * `{ pathname, params }`, senão o link apontava para a página com `[slug]`
 * literal no URL. Quem só aceita um caminho fixo (o `switchHref` do
 * `AuthShell`, por exemplo) usa este tipo e não o outro.
 */
export type StaticSitePathname = Exclude<SitePathname, `${string}[${string}`>;
