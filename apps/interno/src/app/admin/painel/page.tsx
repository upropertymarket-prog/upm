import { cookies } from "next/headers";
import { createClient } from "@upm/db/server";
import { InternalChrome } from "../../../components/InternalChrome";
import { setLocalePreference } from "../../actions/preferences";
import { getAdminShellData } from "../../../lib/admin-shell";
import { DashboardView } from "./DashboardView";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = createClient(await cookies());
  const [shell, billing] = await Promise.all([
    getAdminShellData(supabase),
    supabase.rpc("admin_billing_summary"),
  ]);
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
      />
    </InternalChrome>
  );
}
