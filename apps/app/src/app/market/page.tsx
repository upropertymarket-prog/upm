import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { coverUrlsFor } from "@upm/db/property-covers";
import { PageHeader } from "@upm/ui";

import { AppChrome } from "../../components/AppChrome";
import { PropertyFilters } from "../../components/market/PropertyFilters";
import { MarketResults } from "../../components/market/MarketResults";
import type { PropertyCardData } from "../../components/market/PropertyCard";
import { setLocalePreference } from "../actions/preferences";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = {
  negocio?: string;
  tipo?: string;
  tipologia?: string;
  preco_min?: string;
  preco_max?: string;
  cidade?: string;
  pagina?: string;
};

/**
 * Market — lista pública de imóveis (P4-04a)
 * =========================================================================
 * Sem guard de papel (comum a comprador e proprietário — 07 §4.2/§4.3). Lê
 * sempre `properties_public`, nunca `properties` direto (regra crítica de
 * RLS já corrigida em 20260928100100).
 */
export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = createClient(await cookies());
  const [locale, { data: authData }] = await Promise.all([getLocale(), supabase.auth.getUser()]);
  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  const role = profile?.role === "owner" ? "owner" : "buyer";

  const page = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);

  let query = supabase
    .from("properties_public")
    .select("*", { count: "exact" })
    .order("published_at", { ascending: false });

  if (params.negocio) query = query.eq("deal", params.negocio as "sale" | "rent");
  if (params.tipo) query = query.eq("property_type", params.tipo);
  if (params.tipologia) query = query.eq("typology", params.tipologia);
  if (params.preco_min) query = query.gte("price_cents", Number.parseInt(params.preco_min, 10));
  if (params.preco_max) query = query.lte("price_cents", Number.parseInt(params.preco_max, 10));
  if (params.cidade) query = query.ilike("city", `%${params.cidade}%`);

  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const list = data ?? [];
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Duas ida-e-volta para a página inteira, não duas por cartão: com o
  // `PAGE_SIZE` de 20, a versão anterior fazia 40 pedidos ao Supabase para
  // desenhar esta grelha. Ver a nota em `@upm/db/property-covers`.
  const capas = await coverUrlsFor(
    supabase,
    list.map((property) => property.id),
  );

  const properties: PropertyCardData[] = list.map((property) => ({
    id: property.id ?? "",
    title: property.title,
    deal: property.deal,
    typology: property.typology,
    city: property.city,
    price_cents: property.price_cents,
    rent_cents: property.rent_cents,
    coverUrl: property.id ? (capas.get(property.id) ?? null) : null,
  }));

  const currentQuery = new URLSearchParams();
  if (params.negocio) currentQuery.set("negocio", params.negocio);
  if (params.tipo) currentQuery.set("tipo", params.tipo);
  if (params.tipologia) currentQuery.set("tipologia", params.tipologia);
  if (params.preco_min) currentQuery.set("preco_min", params.preco_min);
  if (params.preco_max) currentQuery.set("preco_max", params.preco_max);
  if (params.cidade) currentQuery.set("cidade", params.cidade);

  return (
    <AppChrome
      role={role}
      userName={profile?.full_name || "Utilizador"}
      userMeta={role === "owner" ? "Proprietário" : "Comprador"}
      activeId="market"
      locale={locale}
      onLocaleChange={setLocalePreference}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <PageHeader
          title="Market"
          subtitle={
            (count ?? 0) === 0
              ? "Sem imóveis publicados para estes filtros"
              : `${count} ${count === 1 ? "imóvel publicado" : "imóveis publicados"}`
          }
        />
        <PropertyFilters
          initial={{
            deal: params.negocio,
            property_type: params.tipo,
            typology: params.tipologia,
            price_min_cents: params.preco_min,
            price_max_cents: params.preco_max,
            city: params.cidade,
          }}
        />
        <MarketResults
          properties={properties}
          page={page}
          pageCount={pageCount}
          query={currentQuery.toString()}
        />
      </div>
    </AppChrome>
  );
}
