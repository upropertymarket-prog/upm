import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@upm/db";
import { asPendingDepartment } from "@upm/db/pending";

/**
 * Dados do shell do Marketing (P10-07 · 07 §24.6)
 * =========================================================================
 * A terceira irmã de `admin-shell.ts` e `support-shell.ts`, para a área que
 * nasce nesta tarefa. Separada e não partilhada, pela mesma razão que separou
 * as duas primeiras: os contadores do Admin vêm de
 * `admin_dashboard_metrics`, que exige `is_admin()` e rebentaria aqui, e os do
 * Suporte vêm de `ticket_counts` e do correio, que o marketing não vê —
 * `is_staff()` não o inclui, de propósito.
 *
 * **Não tem contadores, e isso é a resposta certa para hoje.** Um badge na
 * navegação responde a "quanto trabalho está à minha espera", e nenhum dos
 * três ecrãs da área tem fila: as Atualizações são publicadas por nós, as
 * Campanhas são enviadas por nós e as Métricas são para olhar. Quando houver
 * algo à espera de alguém — uma campanha agendada que falhou, em P10-09 —, é
 * aí que o contador nasce com significado.
 */

type Client = SupabaseClient<Database>;

export type MarketingShellData = {
  userName: string;
  userMeta: string;
  locale: string;
  counters: Record<string, number>;
};

export async function getMarketingShellData(
  supabase: Client,
  groupLabel: string,
): Promise<MarketingShellData> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileResult, staffResult] = await Promise.all([
    user
      ? supabase.from("profiles").select("full_name, locale").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("staff_members").select("department").eq("profile_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const profile = profileResult.data;
  // `asPendingDepartment`: o enum gerado ainda não conhece `marketing` (D64).
  const department = asPendingDepartment(staffResult.data?.department);

  return {
    userName: profile?.full_name?.trim() || user?.email || "—",
    // "Marketing · marketing" é redundante, e acontece porque o departamento
    // tem o mesmo nome da área. Mostra-se só o grupo nesse caso.
    userMeta:
      department && department !== "marketing" ? `${groupLabel} · ${department}` : groupLabel,
    locale: profile?.locale ?? "pt",
    counters: {},
  };
}
