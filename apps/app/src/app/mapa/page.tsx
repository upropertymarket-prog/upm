import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@upm/db/server";

import { AppChrome } from "../../components/AppChrome";
import { PropertyMap } from "../../components/map/PropertyMap";
import { setLocalePreference } from "../actions/preferences";
import { propertiesWithinPolygon } from "../actions/map";

export const dynamic = "force-dynamic";

/**
 * Mapa (P4-05) — sem guard de papel (comum a comprador e proprietário).
 * Traz todos os imóveis via `properties_for_map` sem bounding box: o dataset
 * é pequeno nesta fase.
 */
export default async function MapPage() {
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

  const { data: properties } = await supabase.rpc("properties_for_map", {});

  return (
    <AppChrome
      role={role}
      userName={profile?.full_name || "Utilizador"}
      userMeta={role === "owner" ? "Proprietário" : "Comprador"}
      activeId="map"
      locale={locale}
      onLocaleChange={setLocalePreference}
      // 04 §1.5 — o Mapa é a exceção ao limite de 1600 px: aqui o conteúdo é a
      // própria área visível, e limitá-lo desperdiça o ecrã onde ele mais serve.
      contentWidth="full"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 className="upm-card__title">Mapa</h1>
        <PropertyMap initialProperties={properties ?? []} onDrawPolygon={propertiesWithinPolygon} />
      </div>
    </AppChrome>
  );
}
