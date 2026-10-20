import { useTranslations } from "next-intl";

import { PropertyCard, type PropertyCardData } from "./PropertyCard";
import { MarketPagination } from "./MarketPagination";

export type MarketResultsProps = {
  properties: PropertyCardData[];
  page: number;
  pageCount: number;
  /** Query params atuais (sem `pagina`), já como string pronta a anexar. */
  query: string;
};

/**
 * Grelha de resultados do Market (P4-04a) + paginação. Extraído de
 * `market/page.tsx` para ser reutilizável fora do Server Component (ex.
 * canvas de demonstração), com `properties` já resolvidas (signed URLs
 * incluídas) em vez de acesso direto ao Supabase.
 */
export function MarketResults({ properties, page, pageCount, query }: MarketResultsProps) {
  const t = useTranslations("market");

  return (
    <>
      {properties.length === 0 ? (
        <p>{t("noResults")}</p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
          }}
        >
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
      <MarketPagination page={page} pageCount={pageCount} query={query} />
    </>
  );
}
