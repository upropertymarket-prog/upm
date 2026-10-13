import type { MetadataRoute } from "next";
import { SEO_ROUTES } from "@upm/config/seo-routes";

import { getLaunchMode } from "../lib/launch-mode";
import { getPublicListings, LISTINGS_PAGE_SIZE } from "../lib/public-listings";

/**
 * `sitemap.xml` do site público (P2-06 · 04 §2.1.1)
 * =========================================================================
 * **Gerado do inventário, não escrito à mão.** `SEO_ROUTES` é produzido por
 * `pnpm seo:routes` a partir dos `seo.ts` de cada rota, e é o mesmo inventário
 * que o `/admin/seo` e o `gate:seo` usam. Uma lista escrita à mão aqui ficaria
 * desatualizada no dia em que alguém criasse uma rota — e ninguém daria por
 * isso, porque um sitemap incompleto não parte nada visível.
 *
 * ## O que fica de fora, e porquê
 *
 *  - **As rotas `noindex`.** `/entrar`, `/recuperar-palavra-passe` (e o
 *    `confirmar`) e `/criar-conta/verificacao` dizem ao robô para não as
 *    indexar; listá-las no sitemap seria pedir exatamente o contrário na mesma
 *    respiração. O campo `noindex` passou a vir no inventário por causa disto.
 *  - **As rotas dinâmicas como template.** `/imoveis/[slug]` não é um URL: é um
 *    molde. O que entra são as propriedades concretas, logo abaixo.
 *  - **`/imoveis` em pré-lançamento.** Nesse modo a página existe mas não tem
 *    catálogo, e a própria `generateMetadata` da rota põe-lhe `noindex` — é a
 *    mesma decisão, aplicada ao sitemap.
 *
 * ## As propriedades
 *
 * Só em pós-lançamento, e só as que `properties_public` devolve — ou seja, as
 * que estão `active`/`featured`. Uma propriedade vendida sai da view e sai do
 * sitemap no mesmo instante, que é o comportamento certo: o Google deixa de a
 * revisitar e a página responde com o ecrã de anúncio encerrado.
 *
 * **Teto de 5000 URL.** O limite do protocolo são 50 000 por ficheiro, mas o
 * que trava aqui não é esse: é o número de consultas: a paginação de
 * `getPublicListings` traz `LISTINGS_PAGE_SIZE` de cada vez, e um sitemap que
 * percorra um catálogo inteiro a cada regeneração é trabalho de base de dados
 * proporcional ao catálogo. Cinco mil chegam com folga para o primeiro ano; no
 * dia em que não chegarem, o caminho é partir isto num índice de sitemaps
 * (`generateSitemaps`), não subir o número.
 *
 * ## A revalidação real é de um minuto, não a hora declarada aqui
 *
 * `export const revalidate = 3600` é o teto desta rota, mas o build reporta
 * `1m` — e está certo: `getLaunchMode()` lê por `unstable_cache` com
 * `revalidate: 60`, e a janela mais curta de uma dependência manda na da rota.
 * Fica assim de propósito. O que o minuto garante é que, quando o Admin troca
 * `launch_mode`, o `sitemap` acompanha quase de imediato em vez de anunciar
 * durante uma hora um catálogo que já abriu (ou que ainda não).
 *
 * A hora continua declarada porque é o que esta rota pediria por si só: no dia
 * em que o modo deixar de ser lido aqui, é esse o valor que fica a valer.
 */

export const revalidate = 3600;

const MAX_LISTING_URLS = 5000;

function siteUrl(): string {
  return (process.env.WEB_URL ?? "http://localhost:4300").replace(/\/+$/, "");
}

/** A home é a única com prioridade distinta; o resto fica no valor por omissão. */
function priorityFor(route: string): number {
  if (route === "/") return 1;
  if (route === "/imoveis" || route === "/pre-inscricao") return 0.8;
  return 0.5;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const launchMode = await getLaunchMode();
  const base = siteUrl();
  const now = new Date();

  const staticEntries = SEO_ROUTES.filter((entry) => {
    if (entry.noindex || entry.dynamic) return false;
    // Ver a nota acima: em `pre` o Market vai com `noindex`.
    if (entry.route === "/imoveis" && launchMode === "pre") return false;
    return true;
  }).map((entry) => ({
    url: `${base}${entry.route === "/" ? "" : entry.route}`,
    lastModified: now,
    changeFrequency: (entry.route === "/" ? "daily" : "monthly") as "daily" | "monthly",
    priority: priorityFor(entry.route),
  }));

  if (launchMode === "pre") return staticEntries;

  const listingEntries: MetadataRoute.Sitemap = [];
  for (let page = 1; listingEntries.length < MAX_LISTING_URLS; page += 1) {
    const { listings, total } = await getPublicListings({}, page);
    if (listings.length === 0) break;

    for (const listing of listings) {
      listingEntries.push({
        url: `${base}/imoveis/${listing.slug}`,
        // `publishedAt` e não "agora": dizer que todas as páginas mudaram
        // sempre que o sitemap é regenerado é ruído, e os robôs aprendem a
        // ignorar um `lastmod` que nunca corresponde a uma alteração real.
        lastModified: listing.publishedAt ? new Date(listing.publishedAt) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      });
    }

    if (page * LISTINGS_PAGE_SIZE >= total) break;
  }

  return [...staticEntries, ...listingEntries.slice(0, MAX_LISTING_URLS)];
}
