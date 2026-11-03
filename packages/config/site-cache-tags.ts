/**
 * As etiquetas da cache do site público (F2 · D61) — sem dependências
 * =========================================================================
 * À parte de `site-cache.ts` para poderem ser importadas de qualquer lado,
 * incluindo código que chega ao browser: `site-cache.ts` usa `node:crypto`.
 * O `www` marca as leituras com estas etiquetas; o `interno` e o `app` pedem
 * a invalidação das mesmas. Um nome escrito à mão de um lado só divergia.
 */

/** Etiquetas que o `www` aceita invalidar. Uma lista fechada: o pedido não escolhe à solta. */
export const SITE_CACHE_TAGS = {
  listings: "listings",
  launchMode: "launch-mode",
  plans: "public-plans",
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const listingTag = (id: string) => `listing:${id}`;
export const seoTag = (route: string, locale: string) => `seo:${locale}:${route}`;

export function isSiteCacheTag(tag: string): boolean {
  if ((Object.values(SITE_CACHE_TAGS) as string[]).includes(tag)) return true;
  if (tag.startsWith("listing:")) return UUID.test(tag.slice("listing:".length));
  // `seo:<locale>:<rota>` — as rotas são as do site, em minúsculas.
  return /^seo:(pt|en):\/[a-z0-9\-/[\]]{0,200}$/.test(tag);
}
