import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient, obterUtilizador } from "@upm/db/server";

import { BuyerPanel } from "./BuyerPanel";
import { OwnerPanel } from "./OwnerPanel";

export const dynamic = "force-dynamic";

/**
 * `/painel` — encaminhador por papel (04 §8.3 e §2.4 · fecha D33)
 * =========================================================================
 * A rota deixou de ser só do proprietário: cada papel tem o seu painel, e a
 * escolha faz-se aqui, com o papel lido do servidor. Era a condição que o
 * próprio middleware escrevia para sair da lista `OWNER_ONLY_PREFIXES`
 * ("quando existir, esta rota deixa de ser owner-only").
 *
 * Defesa em profundidade na mesma (08 §7.3): o middleware já filtra a equipa
 * para `interno.*` e as contas suspensas, e aqui volta a confirmar-se que há
 * sessão e perfil antes de qualquer leitura de dados.
 */
export default async function DashboardPage() {
  const supabase = createClient(await cookies());
  const [locale, { data: authData }] = await Promise.all([getLocale(), obterUtilizador(supabase)]);

  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/");

  const fullName = profile.full_name || "";

  if (profile.role === "buyer") {
    return <BuyerPanel userId={user.id} fullName={fullName} locale={locale} />;
  }
  if (profile.role !== "owner") redirect("/");

  return <OwnerPanel userId={user.id} fullName={fullName} locale={locale} />;
}
