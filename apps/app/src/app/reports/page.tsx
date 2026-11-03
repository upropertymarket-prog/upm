import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient, obterUtilizador } from "@upm/db/server";
import { myReports } from "@upm/db/support";

import { AppChrome } from "../../components/AppChrome";
import { setLocalePreference } from "../actions/preferences";
import { ReportsTimeline } from "./ReportsTimeline";

/**
 * `/reports` — a timeline de quem reportou (04 §2.3 · 07 §5.11)
 * =========================================================================
 * O outro lado de `/suporte/tickets`. Mostra os cinco passos em linguagem
 * simples — Recebido, Em análise, A corrigir, Em teste, Resolvido — e o texto
 * "o que foi corrigido" que 04 §2.7 #5 promete.
 *
 * **Não mostra um único facto técnico**, e isso está garantido na base de
 * dados: `my_reports()` não devolve `breadcrumbs`, `console_errors`,
 * `fingerprint` nem `affected_users`. Não é uma escolha deste ecrã que alguém
 * possa desfazer por engano ao acrescentar uma coluna a um `select`.
 */

export const dynamic = "force-dynamic";

export default async function MyReportsPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await obterUtilizador(supabase);
  if (!user) redirect("/");

  const [profile, reports, locale, t] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle(),
    myReports(supabase),
    getLocale(),
    getTranslations(),
  ]);

  const role = profile.data?.role;
  if (role !== "buyer" && role !== "owner") redirect("/");

  return (
    <AppChrome
      role={role}
      userName={profile.data?.full_name?.trim() || user.email || "—"}
      userMeta={t(`sidebar.groups.${role === "owner" ? "manage" : "search"}`)}
      activeId="myReports"
      locale={locale}
      onLocaleChange={setLocalePreference}
    >
      <ReportsTimeline reports={reports} locale={locale} />
    </AppChrome>
  );
}
