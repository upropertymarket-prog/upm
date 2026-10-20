import Link from "next/link";
import { useTranslations } from "next-intl";

import type { PublicListingCard } from "../../lib/public-listings";
import { ListingCard } from "./ListingCard";
import { SectionHeading } from "./SiteSection";

/**
 * "Imóveis mais recentes" — a secção da home em pós-lançamento (P2-05 · 04 §2.1)
 * =========================================================================
 * 04 §2.1: em pós-lançamento esta secção **substitui** "Em breve". Os seis
 * últimos publicados, por `published_at desc`, com o CTA "Ver todos os
 * imóveis" para `/imoveis`.
 *
 * **Não se mostra vazia.** Se o catálogo ainda não tiver nada publicado — o
 * caso de staging hoje, onde os 23 imóveis estão todos em `draft` —, quem
 * chama não renderiza a secção: a lista chega vazia e o componente devolve
 * `null`. Uma grelha vazia sob o título "Imóveis mais recentes" diz ao
 * visitante que o site está partido; não ter a secção não diz nada.
 *
 * O modo é pós-lançamento, por isso o lugar não fica a prometer "em breve":
 * quem abre o site já pode criar conta, e a home continua a ter o hero, a
 * plataforma, os preços e as dúvidas.
 */
export function RecentListings({ listings }: { listings: PublicListingCard[] }) {
  const t = useTranslations("site.recentListings");

  if (listings.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: "var(--sp-6)" }}>
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")} body={t("body")} />

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

      <div>
        <Link href="/imoveis" className="upm-btn upm-btn--primary upm-btn--md">
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
