import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import { listTickets, ticketCounts, ticketDetail, ticketHistory } from "@upm/db/support";

import { InternalChrome } from "../../../components/InternalChrome";
import { getAdminSidebarCounters } from "../../../lib/admin-shell";
import { setLocalePreference } from "../../actions/preferences";
import { TicketsManager } from "../../suporte/tickets/TicketsManager";

/**
 * `/admin/tickets` — visibilidade global, sem workflow (07 §5.10)
 * =========================================================================
 * A rota que 07 §5.10 criou ao renomear `/admin/reports`, e que até hoje
 * estava na navegação sem existir. É o **mesmo** componente de
 * `/suporte/tickets` com `readOnly`, e não uma cópia: duas listas de tickets a
 * evoluir em paralelo acabariam a mostrar números diferentes do mesmo estado,
 * que é o pior defeito possível num ecrã de supervisão.
 *
 * `readOnly` esconde os controlos; quem os forçasse mesmo assim bate em três
 * camadas — a action, a função SQL (`not_support`) e a policy de update.
 */

export const dynamic = "force-dynamic";

const tabSchema = z.enum(["pending", "inProgress", "awaitingConfirmation", "closed"]);
const uuid = z.string().uuid();

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tabResult = tabSchema.safeParse(first(params.tab) ?? "");
  const tab = tabResult.success ? tabResult.data : "pending";
  const search = (first(params.q) ?? "").trim().slice(0, 120);
  const selectedRaw = first(params.id);
  const selectedId = selectedRaw && uuid.safeParse(selectedRaw).success ? selectedRaw : null;

  const supabase = createClient(await cookies());
  const t = await getTranslations();

  const [auth, rows, counts, sidebarCounters] = await Promise.all([
    supabase.auth.getUser(),
    listTickets(supabase, { tab, search }),
    ticketCounts(supabase),
    getAdminSidebarCounters(supabase),
  ]);

  const [selected, history] = selectedId
    ? await Promise.all([ticketDetail(supabase, selectedId), ticketHistory(supabase, selectedId)])
    : [null, []];

  const userId = auth.data.user?.id ?? null;
  const [{ data: profile }, { data: staff }] = await Promise.all([
    userId
      ? supabase.from("profiles").select("full_name,locale").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    userId
      ? supabase.from("staff_members").select("department").eq("profile_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const locale = profile?.locale ?? "pt";

  return (
    <InternalChrome
      role="admin"
      userName={profile?.full_name?.trim() || auth.data.user?.email || "—"}
      userMeta={
        staff?.department
          ? `${t("sidebar.groups.admin")} · ${staff.department}`
          : t("sidebar.groups.admin")
      }
      activeId="tickets"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={sidebarCounters}
    >
      <TicketsManager
        rows={rows}
        counts={counts}
        tab={tab}
        search={search}
        selected={selected}
        history={history}
        readOnly
      />
    </InternalChrome>
  );
}
