import { cookies } from "next/headers";
import { createClient } from "@upm/db/server";
import { InternalChrome } from "../../../components/InternalChrome";
import { setLocalePreference } from "../../actions/preferences";
import { getAdminShellData } from "../../../lib/admin-shell";
import { DashboardView } from "./DashboardView";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = createClient(await cookies());
  const [shell, billing, mailboxes] = await Promise.all([
    getAdminShellData(supabase),
    supabase.rpc("admin_billing_summary"),
    // Só o que o painel resume: estado e se a credencial está definida. Nem o
    // `secret_id` nem o servidor — o Painel conta caixas, não as configura.
    supabase.from("mailboxes").select("status, secret_id"),
  ]);

  /**
   * O resumo de "Config. E-mail" (P10-03).
   *
   * Contado aqui e não no cliente: o que atravessa é um objeto de três números,
   * em vez da lista de caixas. O `secret_id` nunca sai do servidor — o que o
   * painel precisa de saber é *quantas* estão por configurar, não qual é o
   * ponteiro de nenhuma delas (08 §6.3).
   */
  const rows = mailboxes.data ?? [];
  const mailConfig = {
    total: rows.length,
    pending: rows.filter((row) => row.secret_id === null).length,
    failing: rows.filter((row) => row.status === "error").length,
  };

  return (
    <InternalChrome
      role="admin"
      userName={shell.userName}
      userMeta={shell.userMeta}
      activeId="dashboard"
      locale={shell.locale}
      onLocaleChange={setLocalePreference}
      counters={shell.counters}
    >
      <DashboardView
        data={shell.dashboard}
        mrrCents={Number(billing.data?.[0]?.mrr_cents ?? 0)}
        locale={shell.locale}
        loadError={!shell.dashboard || Boolean(billing.error)}
        // Um erro a ler as caixas não deve esconder o Painel inteiro: entra
        // como `null` e o cartão diz que não conseguiu contar.
        mailConfig={mailboxes.error ? null : mailConfig}
      />
    </InternalChrome>
  );
}
