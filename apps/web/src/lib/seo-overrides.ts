import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getLocale } from "next-intl/server";
import { resolveLocale } from "@upm/config";
import { createAnonClient } from "@upm/db/server";

import { buildMetadata, type RouteSeo, type SeoOverride, type SeoPath } from "./seo";

/**
 * A sobreposição de SEO vinda de `seo_pages` (P2-06 2.ª metade · 07 §24.5)
 * =========================================================================
 * O `seo.ts` de cada rota continua a ser a fonte de verdade versionada; isto é
 * só a camada por cima, para o marketing corrigir um título em produção sem
 * esperar por um deploy. `buildMetadata` já sabe combinar as duas — campos
 * vazios não sobrepõem — e os testes dele cobrem essa regra.
 *
 * **Cliente `anon` e sem cookies**, como no `launch-mode`: o SEO de uma página
 * é o mesmo para toda a gente, e passar a sessão tornaria a resposta
 * impossível de partilhar em cache. A policy de leitura de `seo_pages` é
 * pública justamente porque tudo o que lá está acaba impresso no HTML.
 *
 * **Uma leitura por rota, com tag por rota.** Uma leitura única da tabela
 * inteira seria menos pedidos, mas invalidar o título de `/termos` deitaria
 * abaixo a cache de todas as outras páginas.
 *
 * `revalidate: 60` é a rede de segurança e, hoje, é também o mecanismo
 * principal: a invalidação imediata exigiria o Admin — que corre noutro
 * processo Next — chamar uma rota do `www`, e essa rota nunca chegou a existir
 * (o comentário do `launch-mode.ts` promete-a desde a Fase 2). Até lá, uma
 * alteração no Admin aparece no site dentro de um minuto, que é o que 04
 * §2.1.1 pede ("sem novo deploy"), e a chamada direta fica como **D61**.
 *
 * Falha aberta, ao contrário do `launch-mode`: sem a tabela, a página sai com
 * o SEO do ficheiro. O pior resultado possível é o site ficar com os
 * metadados versionados — que é exatamente o que tinha antes desta camada.
 */

export const seoTag = (route: string) => `seo:${route}`;

async function fetchOverride(route: string): Promise<SeoOverride> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("seo_pages")
    .select(
      "title_tag, meta_description, og_same_as_page, og_title, og_description, og_image, og_image_alt, canonical, noindex",
    )
    .eq("route", route)
    .maybeSingle();

  if (error || !data) return null;

  // `null` em coluna significa "o ficheiro manda", e `buildMetadata` espera
  // `undefined` para esse caso — `null` ali seria lido como valor.
  const value = <T>(raw: T | null): T | undefined => raw ?? undefined;

  return {
    titleTag: value(data.title_tag),
    metaDescription: value(data.meta_description),
    ogSameAsPage: value(data.og_same_as_page),
    ogTitle: value(data.og_title),
    ogDescription: value(data.og_description),
    ogImage: value(data.og_image),
    ogImageAlt: value(data.og_image_alt),
    canonical: value(data.canonical),
    noindex: value(data.noindex),
  };
}

/**
 * A sobreposição de uma rota, ou `null` quando não há registo — que é o caso
 * normal: a tabela só tem linhas para as páginas que alguém editou.
 */
export async function getSeoOverride(route: string): Promise<SeoOverride> {
  try {
    const cached = unstable_cache(() => fetchOverride(route), ["seo-override", route], {
      tags: [seoTag(route)],
      revalidate: 60,
    });
    return await cached();
  } catch {
    return null;
  }
}

/**
 * O que cada `page.tsx` chama no seu `generateMetadata()`.
 *
 * Existe para que uma rota nova não tenha de se lembrar de ler a sobreposição:
 * é uma chamada só, e quem a esquecer fica sem metadados nenhuns — um erro
 * visível — em vez de ficar com metadados que o Admin não consegue corrigir,
 * que é um erro silencioso e que só aparece quando alguém tenta editá-los.
 */
export async function pageMetadata(seo: RouteSeo, route: SeoPath): Promise<Metadata> {
  /**
   * A sobreposição procura-se pelo **molde** (`/propriedades/[slug]`), não pelo
   * caminho concreto. Até 21 out 2026 ia o concreto, e o efeito era que a
   * página de imóvel nunca encontrava sobreposição nenhuma: o inventário e o
   * `/admin/seo` guardam a rota como molde — é o que a coluna `route` de
   * `seo_pages` contém — e `/propriedades/casa-do-moinho` não casa com isso.
   * Ninguém deu por isso porque a falha é invisível: a página saía com o SEO do
   * ficheiro, que é o resultado certo quando não há registo.
   *
   * O molde é também a única chave que faz sentido aqui. Uma sobreposição por
   * imóvel concreto seria conteúdo, e conteúdo de imóvel vem da propriedade,
   * não de um painel de SEO.
   */
  /**
   * O idioma descobre-se aqui e não em cada `page.tsx`. São treze rotas a
   * chamar isto, e uma que se esquecesse de passar o locale ficava em
   * português sem avisar — exatamente o tipo de falha silenciosa que levou
   * nove meses a dar por si. Assim nenhuma rota tem de saber que o produto é
   * bilingue: pede os metadados e recebe-os na língua em que está a ser
   * servida.
   */
  const [locale, override] = await Promise.all([getLocale(), getSeoOverride(route.pathname)]);
  return buildMetadata(seo, route, resolveLocale(locale), override);
}
