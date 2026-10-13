import type { Metadata } from "next";

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
 * A sobreposição editável no Admin, quando existe. Vem de `seo_pages` e tem
 * precedência sobre o ficheiro (04 §2.1.2): é o que permite ao marketing
 * corrigir um título em produção sem deploy.
 */
export type SeoOverride = Partial<Omit<PageSeo, "pageName">> | null;

export const SEO_LIMITS = { titleTag: 60, metaDescription: 160 } as const;

const SITE_NAME = "UProperty Market";

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
 * Constrói os metadados de uma rota. Chamada pelo `generateMetadata()` de cada
 * `page.tsx`.
 *
 * `route` é o caminho da página (`/`, `/termos`, …) e serve para o canonical e
 * o `og:url`. `override` é o registo de `seo_pages`, quando existir — campos
 * vazios **não** sobrepõem: uma descrição apagada no Admin devolve o controlo
 * ao ficheiro, em vez de publicar uma descrição vazia.
 */
export function buildMetadata(seo: PageSeo, route: string, override: SeoOverride = null): Metadata {
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
  const image = pick("ogImage") ?? DEFAULT_OG_IMAGE;
  const canonical = pick("canonical") ?? absolute(route);
  const noindex = pick("noindex") ?? false;

  return {
    title,
    description,
    alternates: { canonical },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "pt_PT",
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
