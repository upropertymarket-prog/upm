import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import { listTickets, ticketCounts, ticketDetail, ticketHistory } from "@upm/db/support";

import { InternalChrome } from "../../../components/InternalChrome";
import { getSupportShellData } from "../../../lib/support-shell";
import { setLocalePreference } from "../../actions/preferences";
import { saveTicketStatus } from "./actions";
import { TicketsManager } from "./TicketsManager";

/**
 * `/suporte/tickets` — o workflow (P10-02 · 07 §5.10)
 * =========================================================================
 * A primeira rota da área `/suporte`, que até hoje não existia. O estado do
 * ecrã vive no URL (`?tab=&q=&id=`) e não em `useState`: assim um ticket é
 * partilhável por link entre quem está no suporte, que é metade do trabalho de
 * uma fila partilhada.
 */

export const dynamic = "force-dynamic";

const tabSchema = z.enum(["pending", "inProgress", "awaitingConfirmation", "closed"]);
const uuid = z.string().uuid();

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SupportTicketsPage({
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

  const [rows, counts, shell] = await Promise.all([
    listTickets(supabase, { tab, search }),
    ticketCounts(supabase),
    getSupportShellData(supabase, t("sidebar.groups.support")),
  ]);

  const [selected, history] = selectedId
    ? await Promise.all([ticketDetail(supabase, selectedId), ticketHistory(supabase, selectedId)])
    : [null, []];

  return (
    <InternalChrome
      role="support"
      userName={shell.userName}
      userMeta={shell.userMeta}
      activeId="tickets"
      locale={shell.locale}
      onLocaleChange={setLocalePreference}
      counters={shell.counters}
    >
      <TicketsManager
        rows={rows}
        counts={counts}
        tab={tab}
        search={search}
        selected={selected}
        history={history}
        onSave={saveTicketStatus}
      />
    </InternalChrome>
  );
}
