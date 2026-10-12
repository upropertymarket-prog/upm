import { notFound, permanentRedirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { pageMetadata } from "@/lib/seo-overrides";
import { seo } from "./seo";

import { ListingDetail } from "../../../components/site/ListingDetail";
import { getLaunchMode } from "../../../lib/launch-mode";
import {
  getPublicListing,
  listingIdFromSlug,
  listingSlug,
  type PublicListingDetail,
} from "../../../lib/public-listings";
import { setLocalePreference } from "../../actions/preferences";

/**
 * `/imoveis/[slug]` — a ficha pública de um imóvel (P2-05 · 04 §2.1)
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

/** As variáveis do template de 04 §2.1.2, resolvidas com os dados do imóvel. */
function fill(template: string, listing: PublicListingDetail): string {
  const price = (listing.deal === "rent" ? listing.rentCents : listing.priceCents) ?? null;
  const formatted =
    price === null
      ? "preço sob consulta"
      : new Intl.NumberFormat("pt-PT", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(price / 100);

  return (
    template
      .replaceAll("{titulo}", listing.title)
      .replaceAll("{preco}", formatted)
      .replaceAll("{localidade}", listing.city ?? "Portugal")
      .replaceAll("{tipologia}", listing.typology ?? "Imóvel")
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

  // Sem imóvel não se inventam metadados: a página vai dar 404, e um título
  // real numa página inexistente é um convite ao Google para a indexar.
  if (!listing) {
    return { title: "Imóvel não encontrado · UProperty Market", robots: { index: false } };
  }

  return pageMetadata(
    {
      ...seo,
      titleTag: fill(seo.titleTag, listing),
      metaDescription: fill(seo.metaDescription, listing),
      ogImageAlt: fill(seo.ogImageAlt ?? "", listing),
      // Sem imagem OG própria usa a foto de capa; o `buildMetadata` cai para
      // `/og/default.jpg` quando nem isso existe — que hoje é sempre, porque
      // esse ficheiro não existe no projeto (D63).
      ogImage: listing.coverUrl ?? undefined,
      canonical: undefined,
    },
    `/imoveis/${listing.slug}`,
  );
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
 */
function structuredData(listing: PublicListingDetail) {
  const price = (listing.deal === "rent" ? listing.rentCents : listing.priceCents) ?? null;
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listing.title,
    description: listing.description ?? undefined,
    url: `/imoveis/${listing.slug}`,
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
  if (!listing) notFound();

  // Slug desatualizado (o título mudou) → 301 para o canónico.
  const canonicalSlug = listingSlug({ id: listing.id, title: listing.title });
  if (slug !== canonicalSlug) permanentRedirect(`/imoveis/${canonicalSlug}`);

  return (
    <>
      <ListingDetail
        listing={listing}
        locale={locale}
        launchMode={launchMode}
        onLocaleChange={setLocalePreference}
      />

      {/* Dados estruturados no HTML servido, não injetados no cliente — é o que
          04 §2.1.2 AC #4 exige e o que os validadores leem. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(listing)) }}
      />
    </>
  );
}
