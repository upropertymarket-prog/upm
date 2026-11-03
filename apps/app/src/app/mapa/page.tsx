import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { PageHeader } from "@upm/ui";

import { AppChrome } from "../../components/AppChrome";
import { PropertyMap } from "../../components/map/PropertyMap";
import { setLocalePreference } from "../actions/preferences";
import { propertiesInBounds, propertiesWithinPolygon } from "../actions/map";

export const dynamic = "force-dynamic";

/**
 * Mapa (P4-05) — sem guard de papel (comum a comprador e proprietário).
 * Os imóveis vêm pela área visível (`propertiesInBounds`), pedidos pelo
 * próprio mapa quando carrega e a cada movimento. Até 3 nov a página trazia
 * todos "porque o dataset é pequeno" — e acima dos 1000 cortava sem aviso.
 */
export default async function MapPage() {
  const supabase = createClient(await cookies());
  const [locale, tNav, t, { data: authData }] = await Promise.all([
    getLocale(),
    getTranslations("nav"),
    getTranslations("market"),
    supabase.auth.getUser(),
  ]);
  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  const role = profile?.role === "owner" ? "owner" : "buyer";

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
        <PageHeader title={tNav("map")} subtitle={t("inYourArea")} />
        <PropertyMap
          initialProperties={[]}
          onDrawPolygon={propertiesWithinPolygon}
          onViewportChange={propertiesInBounds}
        />
      </div>
    </AppChrome>
  );
}
