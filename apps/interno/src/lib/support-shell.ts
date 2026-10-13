import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@upm/db";
import { mailUnreadCount } from "@upm/db/mail";
import { ticketCounts } from "@upm/db/support";

/**
 * Dados do shell do Suporte (P10-02)
 * =========================================================================
 * A gémea de `admin-shell.ts`, para a área `/suporte` que nasce nesta fase.
 * Separada e não partilhada: os contadores da sidebar do Admin vêm de
 * `admin_dashboard_metrics`, que exige `is_admin()` e rebentaria para o
 * Suporte. São dois papéis e duas leituras.
 */

type Client = SupabaseClient<Database>;

export type SupportShellData = {
  userName: string;
  userMeta: string;
  locale: string;
  counters: Record<string, number>;
};

/**
 * O contador do item "Tickets" é o **por tratar** — `new` + `triage`. Não é o
 * total de abertos: um badge na navegação responde a "quanto trabalho está à
 * minha espera", e um ticket em curso já não está à espera de ninguém.
 */
export async function getSupportShellData(
  supabase: Client,
  groupLabel: string,
): Promise<SupportShellData> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileResult, staffResult, counts, unread] = await Promise.all([
    user
      ? supabase.from("profiles").select("full_name, locale").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("staff_members").select("department").eq("profile_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    ticketCounts(supabase),
    // O badge da Caixa de e-mail: só as por ler que estão na entrada. Arquivar
    // sem ler é uma decisão, e uma decisão tomada não é trabalho à espera.
    mailUnreadCount(supabase),
  ]);

  const profile = profileResult.data;
  const department = staffResult.data?.department;

  return {
    userName: profile?.full_name?.trim() || user?.email || "—",
    userMeta: department ? `${groupLabel} · ${department}` : groupLabel,
    locale: profile?.locale ?? "pt",
    counters: { tickets: counts.pending, mailbox: unread },
  };
}
