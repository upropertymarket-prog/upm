import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { INTL_LOCALE, LOCALES, type Locale, resolveLocale } from "@upm/config";

import { canonicalUrl, type RouteSeo } from "@/lib/seo";
import { permanentRedirect } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/seo-overrides";
import { seo } from "./seo";

import { ListingDetail } from "@/components/site/ListingDetail";
import { ListingGone } from "@/components/site/ListingGone";
import { getLaunchMode } from "@/lib/launch-mode";
import {
  getListingAvailability,
  getPublicListing,
  getPublicListings,
  listingIdFromSlug,
  listingSlug,
  type PublicListingDetail,
} from "@/lib/public-listings";

/**
 * `/propriedades/[slug]` — a ficha pública de um imóvel (P2-05 · 04 §2.1)
 * =========================================================================
 * Esta página é só a camada que **resolve e vai buscar**: o slug, o imóvel, o
 * redirecionamento canónico e os metadados. O que desenha é `ListingDetail`,
 * que recebe tudo por prop — é o que permite ver a ficha no canvas, onde nem a
 * base de dados nem o `next/headers` existem. Mesmo corte do `HomeSections`.
 *
 * **O que a ficha não tem, e não é esquecimento:** nenhum caminho para falar
 * com o proprietário sem sessão. 04 §2.1 é explícito no CTA ("Entrar para
 * falar") e é a promessa do produto — "100 % contactos privados". Um formulário
 * de contacto direto aqui furava-a: o proprietário passaria a receber mensagens
 * de quem não tem conta, que é precisamente o que a plataforma existe para
 * evitar.
 *
 * O slug é `titulo-em-kebab-{uuid}` e resolve-se pelo uuid do fim. Quando o
 * título muda, o slug antigo continua a resolver e a página **redireciona em
 * 301** para o canónico: o link partilhado há seis meses continua a funcionar e
 * o Google consolida o sinal num URL só, em vez de ver duas páginas iguais.
 */

/**
 * As variáveis do template de 04 §2.1.2, resolvidas com os dados do imóvel.
 *
 * **Recebe o idioma** desde 20 out 2026 (D72): o preço era formatado com um
 * `"pt-PT"` fixo e os três valores de recurso estavam em português à mão. Num
 * título em inglês, isso dava um preço com a pontuação portuguesa e um
 * "Propriedade" a meio da frase — e um título é a primeira coisa que alguém lê
 * de uma página partilhada.
 */
function fill(
  template: string,
  listing: PublicListingDetail,
  intlLocale: string,
  labels: { priceOnRequest: string; city: string; typology: string },
): string {
  const price = (listing.deal === "rent" ? listing.rentCents : listing.priceCents) ?? null;
  const formatted =
    price === null
      ? labels.priceOnRequest
      : new Intl.NumberFormat(intlLocale, {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(price / 100);

  return (
    template
      .replaceAll("{titulo}", listing.title)
      .replaceAll("{preco}", formatted)
      .replaceAll("{localidade}", listing.city ?? labels.city)
      .replaceAll("{tipologia}", listing.typology ?? labels.typology)
      // Um template que fique com um buraco ("· em ·") lê-se pior do que um
      // título curto: colapsa-se a pontuação que sobrou.
      .replace(/\s*·\s*·\s*/g, " · ")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = listingIdFromSlug(slug);
  const listing = id ? await getPublicListing(id) : null;

  // Sem propriedade ativa não se inventam metadados: a página vai dar 404 ou
  // dizer que o anúncio saiu, e um título real numa dessas é um convite ao
  // Google para a indexar. `noindex` nos dois casos — num anúncio encerrado é
  // o que substitui o 410 que o App Router não sabe devolver (ver a nota de
  // `ListingGone.tsx`).
  const t = await getTranslations("publicListing");

  if (!listing) {
    const availability = id ? await getListingAvailability(id) : { outcome: "never" as const };
    return {
      title: availability.outcome === "gone" ? t("goneMetaTitle") : t("notFoundMetaTitle"),
      robots: { index: false, follow: true },
    };
  }

  /**
   * Os dois idiomas resolvidos de uma vez, e é o `pageMetadata` que escolhe o
   * do pedido. Preencher só o idioma atual obrigava este sítio a descobri-lo —
   * e era mais um caller a ter de saber que o produto é bilingue.
   */
  const labels = {
    priceOnRequest: t("priceOnRequest"),
    city: t("fallbackCity"),
    typology: t("fallbackTypology"),
  };
  const preenchido = Object.fromEntries(
    LOCALES.map((loc) => {
      const base = seo[loc];
      const intlLocale = INTL_LOCALE[loc];
      return [
        loc,
        {
          ...base,
          titleTag: fill(base.titleTag, listing, intlLocale, labels),
          metaDescription: fill(base.metaDescription, listing, intlLocale, labels),
          ogImageAlt: fill(base.ogImageAlt ?? "", listing, intlLocale, labels),
          // Sem imagem OG própria usa a foto de capa; sem capa, o
          // `buildMetadata` cai para o cartão de omissão — que desde 13 out
          // 2026 existe e é desenhado em `app/og/default.png` (fecha a D63).
          // Até aí caía num ficheiro inexistente e a partilha saía sem imagem.
          ogImage: listing.coverUrl ?? undefined,
          canonical: undefined,
        },
      ];
    }),
  ) as RouteSeo;

  /**
   * O molde e o `slug` à parte, e não o caminho já montado. É aqui que a
   * mudança de 21 out 2026 se paga: de `/propriedades/casa-do-moinho` ninguém
   * deriva `/en/properties/casa-do-moinho`, porque não se sabe que parte do
   * caminho é a rota e que parte é o imóvel. Separados, o canonical e o
   * `hreflang` desta página saem certos nos dois idiomas.
   *
   * O `slug` é o mesmo nas duas línguas: é a identidade do anúncio, não texto
   * de interface. Traduzi-lo dava dois URL para o mesmo imóvel.
   */
  return pageMetadata(preenchido, {
    pathname: "/propriedades/[slug]",
    params: { slug: listing.slug },
  });
}

/**
 * `RealEstateListing` do schema.org, que 04 §2.1 AC pede no pós-lançamento.
 *
 * Fica na página e não no componente: são metadados da rota, não desenho, e
 * numa storyboard não teriam sentido nenhum.
 *
 * Só com o que a view expõe — nada de morada exata nem de dados do dono. O
 * `offers` só entra quando há preço: um `price` nulo seria dados estruturados
 * inválidos, e um validador recusa o bloco inteiro por causa dele.
 *
 * **Recebe o idioma** desde 21 out 2026, pela mesma razão que o canonical: o
 * `url` era `/propriedades/<slug>`, relativo e em português. Relativo já era
 * errado — o schema.org pede um URL absoluto ali —, e com os caminhos
 * traduzidos passava a apontar, numa página `/en`, para um caminho que não
 * existe. É o mesmo `canonicalUrl` do `<head>`, para os dois não divergirem.
 */
function structuredData(listing: PublicListingDetail, locale: Locale) {
  const price = (listing.deal === "rent" ? listing.rentCents : listing.priceCents) ?? null;
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listing.title,
    description: listing.description ?? undefined,
    url: canonicalUrl({ pathname: "/propriedades/[slug]", params: { slug: listing.slug } }, locale),
    image: listing.photoUrls.length > 0 ? listing.photoUrls : undefined,
    datePosted: listing.publishedAt ?? undefined,
    ...(listing.city
      ? {
          address: {
            "@type": "PostalAddress",
            addressLocality: listing.city,
            addressCountry: "PT",
          },
        }
      : {}),
    ...(listing.grossArea
      ? { floorSize: { "@type": "QuantitativeValue", value: listing.grossArea, unitCode: "MTK" } }
      : {}),
    ...(listing.bedrooms ? { numberOfRooms: listing.bedrooms } : {}),
    ...(price !== null
      ? {
          offers: {
            "@type": "Offer",
            price: price / 100,
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };
}

export default async function ListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, locale, launchMode] = await Promise.all([params, getLocale(), getLaunchMode()]);

  const id = listingIdFromSlug(slug);
  if (!id) notFound();

  const listing = await getPublicListing(id);

  // Sem propriedade ativa há dois casos muito diferentes, e até 13 out 2026
  // davam ambos 404. Um anúncio que esteve publicado e saiu merece explicação
  // e alternativas; um uuid que nunca existiu merece o 404. Quem os separa é a
  // `listing_availability`, que só revela o que já foi público — e que falha
  // para `never`, por isso um erro dela nunca inventa uma venda.
  if (!listing) {
    const availability = await getListingAvailability(id);
    if (availability.outcome === "never") notFound();

    // Mesmo negócio e mesma cidade: é tudo o que se sabe do anúncio que saiu.
    // Quatro e não seis — esta é uma secção de consolação, não um catálogo.
    const { listings: alternatives } = availability.city
      ? await getPublicListings(
          { deal: availability.deal ?? undefined, city: availability.city },
          1,
        )
      : { listings: [] };

    return (
      <ListingGone
        availability={availability}
        alternatives={alternatives.slice(0, 4)}
        locale={locale}
        launchMode={launchMode}
      />
    );
  }

  // Slug desatualizado (o título mudou) → 301 para o canónico, **no mesmo
  // idioma**: de `/en/properties/<slug-antigo>` vai-se para
  // `/en/properties/<slug-novo>`, e não para a versão portuguesa. É o
  // `permanentRedirect` do `next-intl` que o garante.
  const canonicalSlug = listingSlug({ id: listing.id, title: listing.title });
  if (slug !== canonicalSlug) {
    permanentRedirect({
      href: { pathname: "/propriedades/[slug]", params: { slug: canonicalSlug } },
      locale: resolveLocale(locale),
    });
  }

  return (
    <>
      <ListingDetail listing={listing} locale={locale} launchMode={launchMode} />

      {/* Dados estruturados no HTML servido, não injetados no cliente — é o que
          04 §2.1.2 AC #4 exige e o que os validadores leem. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData(listing, resolveLocale(locale))),
        }}
      />
    </>
  );
}
