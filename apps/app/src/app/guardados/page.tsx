import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Bookmark } from "lucide-react";
import { createClient } from "@upm/db/server";
import { EmptyState, StatusTag, Table, type TableColumn } from "@upm/ui";

import { AppChrome } from "../../components/AppChrome";
import { setLocalePreference } from "../actions/preferences";
import { formatCents } from "../../lib/money";

export const dynamic = "force-dynamic";

type SavedRow = {
  id: string;
  propertyId: string;
  title: string | null;
  deal: "sale" | "rent" | null;
  priceAtSave: number | null;
  currentPrice: number | null;
};

/**
 * Guardados (P4-04b) — buyer-only, já garantido pelo `middleware.ts`. Duas
 * queries simples (sem view nova): `saved_properties` do utilizador, depois
 * `properties_public.in("id", ids)` para os dados atuais.
 */
export default async function SavedPropertiesPage() {
  const supabase = createClient(await cookies());
  const [locale, { data: authData }] = await Promise.all([getLocale(), supabase.auth.getUser()]);
  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: saved } = await supabase
    .from("saved_properties")
    .select("id, property_id, price_at_save_cents")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const savedList = saved ?? [];
  const propertyIds = savedList.map((row) => row.property_id);

  const { data: properties } =
    propertyIds.length > 0
      ? await supabase.from("properties_public").select("*").in("id", propertyIds)
      : { data: [] };

  const byId = new Map((properties ?? []).map((property) => [property.id, property]));

  const rows: SavedRow[] = savedList.map((row) => {
    const property = byId.get(row.property_id);
    const currentPrice = property?.price_cents ?? property?.rent_cents ?? null;
    return {
      id: row.id,
      propertyId: row.property_id,
      title: property?.title ?? "(imóvel indisponível)",
      deal: property?.deal ?? null,
      priceAtSave: row.price_at_save_cents,
      currentPrice,
    };
  });

  const columns: TableColumn<SavedRow>[] = [
    {
      id: "title",
      header: "Imóvel",
      cell: (row) => <a href={`/market/${row.propertyId}`}>{row.title}</a>,
    },
    {
      id: "deal",
      header: "Negócio",
      cell: (row) =>
        row.deal ? (
          <StatusTag tone={row.deal === "sale" ? "dealSale" : "dealRent"}>
            {row.deal === "sale" ? "Venda" : "Arrendamento"}
          </StatusTag>
        ) : (
          "—"
        ),
    },
    {
      id: "priceAtSave",
      header: "Preço ao guardar",
      numeric: true,
      cell: (row) => formatCents(row.priceAtSave),
    },
    {
      id: "currentPrice",
      header: "Preço atual",
      numeric: true,
      cell: (row) => {
        const changed =
          row.priceAtSave !== null &&
          row.currentPrice !== null &&
          row.priceAtSave !== row.currentPrice;
        if (!changed) return formatCents(row.currentPrice);
        const dropped = (row.currentPrice ?? 0) < (row.priceAtSave ?? 0);
        return (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            {formatCents(row.currentPrice)}
            <StatusTag tone={dropped ? "active" : "rejected"}>
              {dropped ? "Desceu" : "Subiu"}
            </StatusTag>
          </span>
        );
      },
    },
  ];

  return (
    <AppChrome
      role="buyer"
      userName={profile?.full_name || "Comprador"}
      userMeta="Comprador"
      activeId="saved"
      locale={locale}
      onLocaleChange={setLocalePreference}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="upm-card__title">Guardados</h1>
          <Link href="/guardados/alertas">Alertas de pesquisa</Link>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Bookmark size={40} />}
            title="Ainda não guardou nenhum imóvel"
            description="Explore o Market e guarde os imóveis que lhe interessam."
            action={
              <Link href="/market" className="upm-btn upm-btn--primary upm-btn--md">
                Explorar Market
              </Link>
            }
          />
        ) : (
          <Table
            caption="Imóveis guardados"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
          />
        )}
      </div>
    </AppChrome>
  );
}
