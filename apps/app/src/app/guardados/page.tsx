import type { Route } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Bookmark } from "lucide-react";
import { createClient, obterUtilizador } from "@upm/db/server";
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
  const [locale, t, tNav, tProp, tAlerts, tRoles, { data: authData }] = await Promise.all([
    getLocale(),
    getTranslations("saved"),
    getTranslations("nav"),
    getTranslations("property"),
    getTranslations("market.alerts"),
    getTranslations("roles"),
    obterUtilizador(supabase),
  ]);
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
      title: property?.title ?? t("unavailable"),
      deal: property?.deal ?? null,
      priceAtSave: row.price_at_save_cents,
      currentPrice,
    };
  });

  const columns: TableColumn<SavedRow>[] = [
    {
      id: "title",
      header: tProp("fields.property"),
      cell: (row) => <Link href={`/market/${row.propertyId}` as Route}>{row.title}</Link>,
    },
    {
      id: "deal",
      header: tProp("fields.deal"),
      cell: (row) =>
        row.deal ? (
          <StatusTag tone={row.deal === "sale" ? "dealSale" : "dealRent"}>
            {tProp(`deal.${row.deal}`)}
          </StatusTag>
        ) : (
          "—"
        ),
    },
    {
      id: "priceAtSave",
      header: t("priceAtSave"),
      numeric: true,
      cell: (row) => formatCents(row.priceAtSave),
    },
    {
      id: "currentPrice",
      header: t("currentPrice"),
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
              {dropped ? t("dropped") : t("rose")}
            </StatusTag>
          </span>
        );
      },
    },
  ];

  return (
    <AppChrome
      role="buyer"
      userName={profile?.full_name || tRoles("buyer")}
      userMeta={tRoles("buyer")}
      activeId="saved"
      locale={locale}
      onLocaleChange={setLocalePreference}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="upm-card__title">{tNav("saved")}</h1>
          <Link href="/guardados/alertas">{tAlerts("title")}</Link>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Bookmark size={40} />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <Link href="/market" className="upm-btn upm-btn--primary upm-btn--md">
                {t("exploreMarket")}
              </Link>
            }
          />
        ) : (
          <Table caption={t("caption")} columns={columns} rows={rows} rowKey={(row) => row.id} />
        )}
      </div>
    </AppChrome>
  );
}
