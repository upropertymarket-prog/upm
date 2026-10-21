import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@upm/config";

// Caminho relativo, e não `@/i18n/pathnames`: o `seo.test.ts` corre em Vitest
// sem o plugin dos `paths` do tsconfig, e o alias não resolveria lá.
import { pathnameFor, type SitePathname } from "../i18n/pathnames";

/**
 * SEO e Open Graph por rota (P2-06 · 04 §2.1.2 · 07 §2.1 e §2.2)
 * =========================================================================
 * **A fonte de verdade é um ficheiro por rota**, `app/<rota>/seo.ts`, versionado
 * no git. É o que `check-seo` verifica no CI e o que as storyboards do canvas
 * leem e escrevem. A camada de base de dados (`seo_pages`, `/admin/seo`) entra
 * por cima disto e sobrepõe-se quando existe registo — 07 §24.5.
 *
 * Porque é que o valor por omissão vive em código e não na base de dados: uma
 * rota nova sem SEO tem de **falhar o PR**, não ficar à espera de alguém se
 * lembrar de a preencher num painel. Uma tabela não sabe que páginas existem;
 * o repositório sabe.
 *
 * O que este ficheiro NÃO faz: não escreve conteúdo. Se um título aqui tiver
 * texto por omissão, é o nome da marca, nunca a descrição de uma página.
 *
 * ---------------------------------------------------------------------------
 * BILINGUE DESDE 20 OUT 2026 (D72)
 * ---------------------------------------------------------------------------
 * Cada rota passa a declarar os dois idiomas: `{ pt: {…}, en: {…} }`. Até aqui
 * declarava um só, e o resultado era um site que trocava de idioma em toda a
 * interface e mantinha o título e a descrição em português — pior do que não
 * traduzir, porque a página dizia uma coisa e o separador do browser outra.
 *
 * **O texto fica aqui e não em `messages/*.json`**, ao contrário de todo o
 * resto do produto. Não é inconsistência, é a natureza da coisa: isto não é
 * texto de ecrã, é metadado por rota. Vive aqui porque é daqui que o
 * `check-seo` o exige a cada PR, é isto que as storyboards do canvas leem e
 * escrevem, e é por rota que a sobreposição do `/admin/seo` se aplica. Num
 * ficheiro de mensagens perdia as três coisas. Quem garante que **os dois
 * idiomas** estão preenchidos é o `check-seo`, que é o portão certo para isto —
 * e é por isso que o `check-i18n` deixou de os contar.
 */

export type PageSeo = {
  /** Nome legível da página, para a lista de `/admin/seo`. */
  pageName: string;
  /** ≤ 60 caracteres (04 §2.1.1). `check-seo` avisa acima disso. */
  titleTag: string;
  /** ≤ 160 caracteres. */
  metaDescription: string;
  /** Ligado por omissão: o OG herda o título e a descrição da página. */
  ogSameAsPage?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  /** Caminho em `public/`, 1200×630. Sem valor, usa a imagem da marca. */
  ogImage?: string;
  ogImageAlt?: string;
  canonical?: string;
  noindex?: boolean;
};

/**
 * O que um `seo.ts` exporta: a mesma rota nos dois idiomas.
 *
 * Os dois são obrigatórios de propósito. Com o `en` opcional, uma rota nova
 * entrava em produção com o inglês a cair para português sem ninguém notar — e
 * era precisamente esse silêncio que levou o site a ter nove meses de
 * interface bilingue com metadados monolíngues.
 */
export type RouteSeo = Record<Locale, PageSeo>;

/**
 * A sobreposição editável no Admin, quando existe. Vem de `seo_pages` e tem
 * precedência sobre o ficheiro (04 §2.1.2): é o que permite ao marketing
 * corrigir um título em produção sem deploy.
 */
export type SeoOverride = Partial<Omit<PageSeo, "pageName">> | null;

export const SEO_LIMITS = { titleTag: 60, metaDescription: 160 } as const;

const SITE_NAME = "UProperty Market";

/** O que o `og:locale` espera — não é a etiqueta `Intl`, é o formato do OG. */
const OG_LOCALE: Record<Locale, string> = { pt: "pt_PT", en: "en_GB" };

/**
 * Desenhada em `app/og/default.png/route.tsx`, não um ficheiro em `public/`.
 *
 * Apontava para `/og/default.jpg`, que **nunca existiu** — era a D63, e o
 * efeito era todas as partilhas do site saírem sem imagem, porque nenhuma rota
 * declara `ogImage` e portanto todas caem aqui. A rota que a substitui explica
 * ao pormenor porque é gerada em vez de versionada; em duas linhas: o ícone da
 * marca ainda não foi entregue e não se deriva um a partir do wordmark.
 */
const DEFAULT_OG_IMAGE = "/og/default.png";

/**
 * O cartão de omissão no idioma da página.
 *
 * O `lang` vai no URL porque um scraper de Open Graph pede a imagem **sem
 * cookies** — sem o parâmetro, uma página de `/en` saía partilhada com o
 * cartão em português. A língua-fonte fica sem parâmetro para o URL não mudar
 * nas páginas que já existiam.
 */
function defaultOgImage(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? DEFAULT_OG_IMAGE : `${DEFAULT_OG_IMAGE}?lang=${locale}`;
}

/**
 * O URL público. Lê-se de `WEB_URL` para que staging não anuncie canonicals de
 * produção — um `og:url` errado é um link partilhado que leva ao sítio errado.
 */
function siteUrl(): string {
  return (process.env.WEB_URL ?? "http://localhost:4300").replace(/\/+$/, "");
}

/** Trailing slash fora, por 07 §2.2 ("removido automaticamente"). */
function absolute(path: string): string {
  const base = siteUrl();
  if (/^https?:\/\//.test(path)) return path.replace(/(?<!:)\/+$/, "");
  const clean = `/${path}`.replace(/\/{2,}/g, "/");
  return `${base}${clean}`.replace(/(?<!:)\/+$/, "") || base;
}

/**
 * Uma rota, como o SEO precisa de a conhecer: o **molde** e, se tiver segmento
 * dinâmico, os valores que o preenchem.
 *
 * Era uma `string` até 21 out 2026, e deixou de poder ser no dia em que os
 * caminhos passaram a traduzir-se. A razão é só uma, e é decisiva: de um
 * caminho concreto em português (`/propriedades/casa-do-moinho`) **não se
 * deriva o inglês** — não se sabe onde acaba o molde e começa o valor, e
 * portanto não se sabe o que traduzir. Do molde mais os parâmetros deriva-se
 * qualquer idioma.
 */
export type SeoPath = {
  pathname: SitePathname;
  params?: Record<string, string>;
};

/**
 * O caminho de uma rota no idioma pedido, **com o caminho traduzido**.
 *
 * Lê o mapa de `i18n/pathnames.ts` à mão e não o `getPathname` do `next-intl`,
 * por duas razões. A de teste: o `seo.test.ts` corre em Node sem React, e a
 * navegação do `next-intl` arrastava o runtime de cliente para dentro dele. E a
 * de facto: **não há `getPathname` fora do `createNavigation`** — a função só
 * existe amarrada ao objeto de navegação, logo "usar a do next-intl" nunca foi
 * uma opção sem pagar o acoplamento.
 *
 * O que se paga em troca é esta função ter de saber duas regras em vez de uma:
 * o prefixo (`pt` sem, `en` com, por `localePrefix: "as-needed"`) e a tradução
 * do caminho. Ambas estão fixadas por testes — se o `localePrefix` do
 * `routing.ts` mudar, ou se alguém apagar a tradução de uma rota, o teste de
 * `hreflang` falha.
 */
export function localizedPath(route: SeoPath, locale: Locale): string {
  const template = pathnameFor(route.pathname, locale);

  const filled = Object.entries(route.params ?? {}).reduce(
    (path, [key, value]) => path.replaceAll(`[${key}]`, encodeURIComponent(value)),
    template,
  );

  const clean = filled === "/" ? "" : filled.replace(/\/+$/, "");
  return locale === DEFAULT_LOCALE ? clean || "/" : `/${locale}${clean}`;
}

/**
 * O URL absoluto de uma rota no idioma pedido — o mesmo que sai no canonical.
 *
 * Existe exportado porque o canonical não é o único sítio que precisa dele: os
 * dados estruturados da ficha de imóvel declaram um `url`, e o schema.org
 * espera ali um URL absoluto. Estava relativo e em português, o que em `/en`
 * apontava para um caminho que deixou de existir.
 */
export function canonicalUrl(route: SeoPath, locale: Locale): string {
  return absolute(localizedPath(route, locale));
}

/**
 * Constrói os metadados de uma rota, no idioma em que a página está a ser
 * servida. Chamada pelo `generateMetadata()` de cada `page.tsx`, através do
 * `pageMetadata`, que é quem descobre o idioma.
 *
 * `route` é o molde da página (`{ pathname: "/termos" }`) e serve para o
 * canonical, o `hreflang` e o `og:url` — e tem de ser o molde, e não o caminho
 * já feito, porque é dele que se derivam as duas línguas.
 * `override` é o registo de `seo_pages`, quando existir — campos
 * vazios **não** sobrepõem: uma descrição apagada no Admin devolve o controlo
 * ao ficheiro, em vez de publicar uma descrição vazia.
 *
 * O `alternates.languages` sai com as duas entradas e com o `x-default`. É
 * isso que diz ao Google que `/termos` e `/en/terms` são a mesma página em
 * duas línguas, e não duas páginas a competir pela mesma consulta — sem ele, o
 * que se ganhava por traduzir era conteúdo duplicado. O `x-default` aponta para
 * a língua-fonte: é o que se serve a quem não casa com nenhuma das duas.
 *
 * O canonical passa a ser o da **própria** versão: `/en/terms` diz que o
 * canónico dele é `/en/terms`, não `/termos`. Um canonical cruzado dizia ao
 * Google para indexar só a portuguesa e deitava fora a tradução toda.
 */
export function buildMetadata(
  routeSeo: RouteSeo,
  route: SeoPath,
  locale: Locale = DEFAULT_LOCALE,
  override: SeoOverride = null,
): Metadata {
  const seo = routeSeo[locale] ?? routeSeo[DEFAULT_LOCALE];

  const pick = <K extends keyof PageSeo>(key: K): PageSeo[K] => {
    const value = override?.[key as keyof SeoOverride] as PageSeo[K] | undefined;
    if (typeof value === "string" && value.trim() === "") return seo[key];
    return value === undefined || value === null ? seo[key] : value;
  };

  const title = pick("titleTag");
  const description = pick("metaDescription");
  const sameAsPage = pick("ogSameAsPage") ?? true;
  const ogTitle = sameAsPage ? title : (pick("ogTitle") ?? title);
  const ogDescription = sameAsPage ? description : (pick("ogDescription") ?? description);
  const image = pick("ogImage") ?? defaultOgImage(locale);
  const canonical = pick("canonical") ?? absolute(localizedPath(route, locale));
  const noindex = pick("noindex") ?? false;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(
          LOCALES.map((outro) => [outro, absolute(localizedPath(route, outro))]),
        ),
        "x-default": absolute(localizedPath(route, DEFAULT_LOCALE)),
      },
    },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale],
      url: canonical,
      title: ogTitle,
      description: ogDescription,
      images: [
        {
          url: absolute(image),
          width: 1200,
          height: 630,
          alt: pick("ogImageAlt") ?? SITE_NAME,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [absolute(image)],
    },
  };
}
