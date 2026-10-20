import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { dealSchema, propertyTypeSchema, typologySchema } from "@upm/db/properties";

import { pageMetadata } from "@/lib/seo-overrides";
import { seo } from "./seo";

import { PublicHeader } from "../../components/PublicHeader";
import { FeatureGrid } from "../../components/site/FeatureGrid";
import { ListingsBrowser } from "../../components/site/ListingsBrowser";
import { SectionHeading, SiteSection } from "../../components/site/SiteSection";
import { SiteFooter } from "../../components/site/SiteFooter";
import { getLaunchMode } from "../../lib/launch-mode";
import { LISTINGS_PAGE_SIZE, getPublicListings } from "../../lib/public-listings";
import { COMING_SOON_CARDS } from "../../lib/site-content";
import { setLocalePreference } from "../actions/preferences";

/**
 * `/imoveis` — o Market público (P2-05 · 04 §2.1)
 * =========================================================================
 * Esta página valida os parâmetros e vai buscar; o que desenha é
 * `ListingsBrowser`, que recebe tudo por prop (mesmo corte do `HomeSections` e
 * do `ListingDetail`). A leitura vai toda por `properties_public`, que é a
 * única porta segura, e serve-se de cache com cinco minutos de ISR.
 *
 * **Em pré-lançamento a página existe mas não finge ter catálogo.** 04 §2.1 põe
 * `/imoveis` no pós-lançamento; apagá-la em `pre` daria 404 a um link
 * partilhado, e mostrá-la vazia daria a impressão de um site sem imóveis. O que
 * faz é dizer a verdade — ainda não abriu — e levar à pré-inscrição. Nesse modo
 * vai com `noindex`: um Market vazio indexado pelo Google é a pior primeira
 * impressão possível, e sai difícil do índice depois.
 */
export async function generateMetadata() {
  const launchMode = await getLaunchMode();
  const base = await pageMetadata(seo, "/imoveis");
  if (launchMode === "post") return base;
  return { ...base, robots: { index: false, follow: true } };
}

type SearchParams = {
  negocio?: string;
  tipo?: string;
  tipologia?: string;
  cidade?: string;
  preco_min?: string;
  preco_max?: string;
  pagina?: string;
};

/** Euros do formulário → cêntimos da base de dados. */
function cents(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const euros = Number(value);
  if (!Number.isFinite(euros) || euros < 0) return undefined;
  return Math.round(euros * 100);
}

/**
 * Um parâmetro só entra no filtro se for um valor que a base de dados conhece.
 * Não é defesa contra injeção — o PostgREST parametriza —, é evitar uma
 * pesquisa que não devolve nada por causa de um valor inventado no URL e que
 * parece um site partido a quem a recebeu por link.
 */
function enumOr<T>(
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  raw: string | undefined,
) {
  if (!raw) return undefined;
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, locale, launchMode, t] = await Promise.all([
    searchParams,
    getLocale(),
    getLaunchMode(),
    getTranslations("site.comingSoon"),
  ]);

  const header = (
    <PublicHeader locale={locale} onLocaleChange={setLocalePreference} launchMode={launchMode} />
  );

  if (launchMode === "pre") {
    return (
      <>
        {header}
        <main>
          <SiteSection>
            <div style={{ display: "grid", gap: "var(--sp-6)" }}>
              <SectionHeading
                eyebrow={t("eyebrow")}
                title={t("title")}
                body={t("body")}
                align="center"
              />
              <FeatureGrid
                cards={COMING_SOON_CARDS.map((card) => ({
                  icon: card.icon,
                  title: t(`cards.${card.id}.title`),
                  body: t(`cards.${card.id}.body`),
                }))}
                minColumn="14rem"
              />
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Link href="/pre-inscricao" className="upm-btn upm-btn--primary upm-btn--md">
                  {t("primaryCta")}
                </Link>
              </div>
            </div>
          </SiteSection>
        </main>
        <SiteFooter />
      </>
    );
  }

  const pageRaw = Number(params.pagina ?? "1");
  const page = Number.isSafeInteger(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 500) : 1;

  const { listings, total } = await getPublicListings(
    {
      deal: enumOr(dealSchema, params.negocio),
      propertyType: enumOr(propertyTypeSchema, params.tipo),
      typology: enumOr(typologySchema, params.tipologia),
      city: params.cidade?.trim().slice(0, 120) || undefined,
      priceMinCents: cents(params.preco_min),
      priceMaxCents: cents(params.preco_max),
    },
    page,
  );

  return (
    <>
      {header}
      <main>
        <SiteSection>
          <ListingsBrowser
            listings={listings}
            total={total}
            page={page}
            pageCount={Math.max(1, Math.ceil(total / LISTINGS_PAGE_SIZE))}
            raw={params}
          />
        </SiteSection>
      </main>
      <SiteFooter />
    </>
  );
}
