import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient, obterUtilizador } from "@upm/db/server";

import { AppChrome } from "../../components/AppChrome";
import { VisitsScreen } from "../../components/visits/VisitsScreen";
import { loadNavCounters, loadNotifications, loadVisits } from "../../lib/interaction";
import { acceptVisit, archiveVisit, cancelVisit, rescheduleVisit } from "../actions/visits";
import { setLocalePreference } from "../actions/preferences";
import { currentMonth } from "../../lib/dates";

export const dynamic = "force-dynamic";

/**
 * Meus pedidos — `/meus-pedidos` (P5-02 · 04 §8.4 · 03 F6)
 * =========================================================================
 * O lado do comprador da mesma agenda (rota renomeada em 07 §4.2:
 * `/pedidos-de-visita` → `/meus-pedidos`). Aqui "Aceitar" aparece quando foi o
 * proprietário a propor a data — o passo 3′ de 03 F6.
 */
export default async function MyRequestsPage({
  searchParams,
}: {
  // `?visita=` vem dos links das notificações de visita (D31).
  searchParams: Promise<{ visita?: string }>;
}) {
  const { visita } = await searchParams;
  const supabase = createClient(await cookies());
  const [locale, { data: authData }] = await Promise.all([getLocale(), obterUtilizador(supabase)]);

  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "buyer") redirect("/");

  const [visits, counters, notifications] = await Promise.all([
    loadVisits(supabase),
    loadNavCounters(supabase, "buyer"),
    loadNotifications(supabase, locale),
  ]);

  return (
    <AppChrome
      role="buyer"
      userName={profile.full_name || "Comprador"}
      userMeta="Comprador"
      activeId="myRequests"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={counters}
      notifications={notifications}
    >
      <VisitsScreen
        rows={visits}
        pageTitle="Meus pedidos"
        pageSubtitle="As visitas que pediu e o estado de cada uma"
        role="buyer"
        month={currentMonth()}
        highlightId={visita ?? null}
        onAccept={acceptVisit}
        onReschedule={rescheduleVisit}
        onCancel={cancelVisit}
        onArchive={archiveVisit}
      />
    </AppChrome>
  );
}
