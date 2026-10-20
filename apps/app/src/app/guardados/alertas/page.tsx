import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import type { PropertyFilters } from "@upm/db/properties";

import { AppChrome } from "../../../components/AppChrome";
import { AlertsManager, type SearchAlertItem } from "../../../components/market/AlertsManager";
import { setLocalePreference } from "../../actions/preferences";
import {
  createSearchAlert,
  deleteSearchAlert,
  updateSearchAlert,
} from "../../actions/search-alerts";

export const dynamic = "force-dynamic";

/** Alertas de pesquisa (P4-04b) — buyer-only, já garantido pelo `middleware.ts`. */
export default async function SearchAlertsPage() {
  const supabase = createClient(await cookies());
  const [locale, t, tRoles, { data: authData }] = await Promise.all([
    getLocale(),
    getTranslations("market.alerts"),
    getTranslations("roles"),
    supabase.auth.getUser(),
  ]);
  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: alerts } = await supabase
    .from("search_alerts")
    .select("id, filters")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const items: SearchAlertItem[] = (alerts ?? []).map((row) => ({
    id: row.id,
    filters: (row.filters ?? {}) as PropertyFilters,
  }));

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
          <h1 className="upm-card__title">{t("title")}</h1>
          <Link href="/guardados">{t("backToSaved")}</Link>
        </div>
        <AlertsManager
          alerts={items}
          createAlert={createSearchAlert}
          updateAlert={updateSearchAlert}
          deleteAlert={deleteSearchAlert}
        />
      </div>
    </AppChrome>
  );
}
