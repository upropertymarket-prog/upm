import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { PageHeader } from "@upm/ui";

import { AppChrome } from "../../components/AppChrome";
import { LeadsScreen } from "../../components/leads/LeadsScreen";
import { loadNavCounters, loadLeads, loadNotifications } from "../../lib/interaction";
import { updateLeadStage } from "../actions/leads";
import { setLocalePreference } from "../actions/preferences";

export const dynamic = "force-dynamic";

/**
 * Leads — `/leads` (P5-03 · 04 §8.3 · 07 §18.2/§18.3)
 * =========================================================================
 * Owner-only. Sem ação primária no cabeçalho: o "Novo contacto" da referência
 * ficou de fora por decisão registada em 07 §18.3 — `owner_leads` aponta para
 * um `profiles`, e um contacto de fora da plataforma não tem onde ser guardado.
 */
export default async function LeadsPage() {
  const supabase = createClient(await cookies());
  const [locale, t, tNav, tRoles, { data: authData }] = await Promise.all([
    getLocale(),
    getTranslations("leads"),
    getTranslations("nav"),
    getTranslations("roles"),
    supabase.auth.getUser(),
  ]);

  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "owner") redirect("/");

  const [leads, counters, notifications] = await Promise.all([
    loadLeads(supabase),
    loadNavCounters(supabase, "owner"),
    loadNotifications(supabase, locale),
  ]);

  const recent = leads.filter(
    (lead) => Date.now() - new Date(lead.lastActivityAt).getTime() < 30 * 24 * 3600 * 1000,
  ).length;

  return (
    <AppChrome
      role="owner"
      userName={profile.full_name || tRoles("owner")}
      userMeta={tRoles("owner")}
      activeId="leads"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={counters}
      notifications={notifications}
    >
      <PageHeader
        title={tNav("leads")}
        subtitle={recent === 0 ? t("pageSubtitleNone") : t("pageSubtitle", { count: recent })}
      />
      <LeadsScreen rows={leads} onUpdateStage={updateLeadStage} />
    </AppChrome>
  );
}
