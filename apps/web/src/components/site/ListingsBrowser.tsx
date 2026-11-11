import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { ListingCard } from "./ListingCard";
import { ListingFilters, type ListingFiltersValue } from "./ListingFilters";
import { SectionHeading } from "./SiteSection";
import type { PublicListingCard } from "../../lib/public-listings";

/**
 * A lista do Market público, sem ir buscar nada (P2-05 · 04 §2.1)
 * =========================================================================
 * Separado da `page.tsx` pela terceira vez e pela mesma razão das outras duas
 * (`HomeSections`, `ListingDetail`): a página lê `searchParams`, valida-os
 * contra os enums de `@upm/db/properties` e consulta `properties_public` — nada
 * disso corre numa storyboard. Aqui entra tudo por prop, e o resultado é
 * revisível no canvas, nos dois temas e nos dois estados que importam: com
 * resultados e sem nenhum.
 *
 * A paginação recebe os filtros como estão no URL (`raw`) e não os validados:
 * é o URL que tem de ser reconstruído, e um filtro que a validação descartou
 * não deve desaparecer do link sem o visitante perceber porquê.
 */
export type ListingsBrowserProps = {
  listings: PublicListingCard[];
  total: number;
  page: number;
  pageCount: number;
  /** Os parâmetros como vieram do URL, para repovoar o formulário. */
  raw: ListingFiltersValue;
};

export function ListingsBrowser({ listings, total, page, pageCount, raw }: ListingsBrowserProps) {
  const t = useTranslations("publicListing");
  const tp = useTranslations("pagination");

  // Um `UrlObject` e não uma cadeia: com `typedRoutes` ligado, o `Link` só
  // aceita uma rota literal ou um objeto — uma cadeia montada em runtime não
  // passa o typecheck, e é esse o ponto da opção (uma rota inexistente falha no
  // build em vez de dar 404 em produção). Mesmo padrão do `Pricing`.
  const pageHref = (target: number) => {
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key !== "pagina" && value) query[key] = value;
    }
    if (target > 1) query.pagina = String(target);
    return { pathname: "/propriedades" as const, query };
  };

  return (
    <div style={{ display: "grid", gap: "var(--sp-6)" }}>
      <SectionHeading
        title={t("browserTitle")}
        // O plural sai do `plural` do ICU e não de um ternário: em inglês a
        // escolha é outra, e o código não tem de saber que idiomas existem.
        body={total === 0 ? t("browserEmpty") : t("browserCount", { count: total })}
      />

      <ListingFilters value={raw} />

      {listings.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-body)",
            color: "var(--muted)",
            textAlign: "center",
            padding: "var(--sp-7)",
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          {/* `t.rich` e não a frase partida em três pedaços de JSX: com o
              texto cortado à volta do `<Link>`, a ordem das palavras ficava
              fixada em português — em inglês a ligação cai noutro sítio da
              frase. O `<link>` da mensagem é que diz onde ela entra. */}
          {t.rich("noResultsFilters", {
            link: (chunks) => <Link href="/propriedades">{chunks}</Link>,
          })}
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(18rem, 100%), 1fr))",
            gap: "var(--sp-5)",
            alignItems: "stretch",
          }}
        >
          {listings.map((listing) => (
            <li key={listing.id} style={{ display: "grid" }}>
              <ListingCard listing={listing} />
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav
          aria-label={t("paginationLabel")}
          style={{
            display: "flex",
            gap: "var(--sp-3)",
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="upm-btn upm-btn--secondary upm-btn--md">
              {tp("previous")}
            </Link>
          ) : null}
          <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
            {t("pageOf", { page, total: pageCount })}
          </span>
          {page < pageCount ? (
            <Link href={pageHref(page + 1)} className="upm-btn upm-btn--secondary upm-btn--md">
              {tp("next")}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
