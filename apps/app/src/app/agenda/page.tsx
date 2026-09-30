import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { PageHeader } from "@upm/ui";

import { AppChrome } from "../../components/AppChrome";
import { VisitsScreen } from "../../components/visits/VisitsScreen";
import {
  countersFor,
  loadConversations,
  loadLeads,
  loadNotifications,
  loadVisits,
} from "../../lib/interaction";
import { acceptVisit, archiveVisit, cancelVisit, rescheduleVisit } from "../actions/visits";
import { setLocalePreference } from "../actions/preferences";
import { currentMonth } from "../../lib/dates";

export const dynamic = "force-dynamic";

/**
 * Agenda de visitas — `/agenda` (P5-02 · 04 §8.3 · 03 F6 · 07 §5.6)
 * =========================================================================
 * Owner-only, com a mesma defesa em profundidade das outras rotas do
 * proprietário: o middleware já filtra, confirma-se aqui na mesma (08 §7.3).
 */
export default async function AgendaPage() {
  const supabase = createClient(await cookies());
  const [locale, { data: authData }] = await Promise.all([getLocale(), supabase.auth.getUser()]);

  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "owner") redirect("/");

  const [visits, conversations, leads, notifications] = await Promise.all([
    loadVisits(supabase),
    loadConversations(supabase),
    loadLeads(supabase),
    loadNotifications(supabase),
  ]);

  return (
    <AppChrome
      role="owner"
      userName={profile.full_name || "Proprietário"}
      userMeta="Proprietário"
      activeId="visitSchedule"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={countersFor("owner", conversations, visits, leads)}
      notifications={notifications}
    >
      <PageHeader
        title="Agenda de visitas"
        subtitle="Gira as visitas agendadas para os seus imóveis"
      />
      <VisitsScreen
        rows={visits}
        role="owner"
        month={currentMonth()}
        onAccept={acceptVisit}
        onReschedule={rescheduleVisit}
        onCancel={cancelVisit}
        onArchive={archiveVisit}
      />
    </AppChrome>
  );
}
