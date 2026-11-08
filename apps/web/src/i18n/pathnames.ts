import type { Locale } from "@upm/config";

/**
 * Os caminhos do site — **traduzidos** (21 out 2026)
 * =========================================================================
 * Cada rota declara o seu caminho em cada idioma: `/termos` em português,
 * `/terms` em inglês. O `next-intl` resolve o resto — o `Link` recebe sempre a
 * chave portuguesa e sai com o caminho do idioma em que a página está.
 *
 * ## Porque é que isto vive num ficheiro só com dados
 *
 * Porque o `lib/seo.ts` tem de o ler. O canonical, o `hreflang` e o
 * `sitemap.xml` precisam de saber o caminho de uma rota em cada idioma, e a
 * única via que o `next-intl` oferece para isso é o `getPathname` do
 * `createNavigation` — que arrasta o runtime de cliente. O `seo.test.ts` corre
 * em Node, e importar navegação para lá partia-o.
 *
 * Então o mapa fica aqui, sem um único import a não ser o tipo do locale, e
 * tanto o `routing.ts` (que o entrega ao `next-intl`) como o `lib/seo.ts` (que
 * o lê à mão) bebem da mesma fonte. Um caminho novo entra uma vez e os dois
 * sabem dele.
 *
 * ## A chave é sempre a portuguesa
 *
 * Não por preferência: é a convenção do `next-intl`. A chave é o identificador
 * interno da rota, e é ela que aparece em todos os `href` do código; o valor é
 * o que vai para o URL. Como a língua-fonte é o português e as pastas do
 * `app/` estão em português, usar outra coisa como chave obrigava a um segundo
 * mapa mental.
 *
 * E a lista existe por um motivo que não é a tradução: **sem ela o `href` do
 * `Link` passa a ser uma `string` qualquer**. O `typedRoutes` do Next deixou de
 * servir aqui no dia em que o union dele passou a ser `/[locale]/termos`. Com
 * estes `pathnames`, quem escrever `/entar` leva um erro de compilação em vez
 * de um 404 em produção.
 */
export const pathnames = {
  "/": "/",
  "/propriedades": { pt: "/propriedades", en: "/properties" },
  "/propriedades/[slug]": { pt: "/propriedades/[slug]", en: "/properties/[slug]" },
  "/termos": { pt: "/termos", en: "/terms" },
  "/privacidade": { pt: "/privacidade", en: "/privacy" },
  // O inglês é igual ao português de propósito: "cookies" é a mesma palavra nas
  // duas línguas, e inventar um caminho diferente só para a lista parecer
  // simétrica dava dois URL para a mesma coisa sem ninguém ganhar nada.
  "/cookies": { pt: "/cookies", en: "/cookies" },
  "/pre-inscricao": { pt: "/pre-inscricao", en: "/early-access" },
  "/pre-inscricao/confirmar": {
    pt: "/pre-inscricao/confirmar",
    en: "/early-access/confirm",
  },
  "/pre-inscricao/remover": {
    pt: "/pre-inscricao/remover",
    en: "/early-access/remove",
  },
  "/criar-conta": { pt: "/criar-conta", en: "/sign-up" },
  "/criar-conta/verificacao": { pt: "/criar-conta/verificacao", en: "/sign-up/verify" },
  "/entrar": { pt: "/entrar", en: "/sign-in" },
  "/recuperar-palavra-passe": { pt: "/recuperar-palavra-passe", en: "/reset-password" },
  "/recuperar-palavra-passe/confirmar": {
    pt: "/recuperar-palavra-passe/confirmar",
    en: "/reset-password/confirm",
  },
  "/cancelar-subscricao": { pt: "/cancelar-subscricao", en: "/cancel-subscription" },
} as const satisfies Record<string, string | Record<Locale, string>>;

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

/**
 * O caminho **sem prefixo de idioma** de uma rota, no idioma pedido.
 *
 * Uma rota pode declarar um caminho só (string) quando é igual nas duas
 * línguas — é o caso da home. Nesse caso o valor serve os dois.
 *
 * Uma rota que não esteja no mapa devolve-se tal e qual. Isso não devia
 * acontecer (o tipo não o deixa), mas o `sitemap.ts` lê um inventário gerado
 * cujo tipo é `string` — e nesse caminho é melhor servir o URL português do que
 * atirar `undefined` para dentro de um `<loc>`.
 */
export function pathnameFor(pathname: string, locale: Locale): string {
  const entry = (pathnames as Record<string, string | Record<Locale, string>>)[pathname];
  if (entry === undefined) return pathname;
  return typeof entry === "string" ? entry : entry[locale];
}
