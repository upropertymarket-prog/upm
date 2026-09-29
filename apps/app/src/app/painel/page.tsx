import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { Button, PageHeader, greetingKey } from "@upm/ui";

import { AppChrome } from "../../components/AppChrome";
import { OwnerDashboard } from "../../components/dashboard/OwnerDashboard";
import type { DashboardStat } from "../../components/dashboard/dashboardTypes";
import { buildViewsSeries, weeklyViews, type ViewRow } from "../../lib/dashboard";
import { setLocalePreference } from "../actions/preferences";

export const dynamic = "force-dynamic";

/** Um ano de histórico chega para os três intervalos do gráfico. */
const HISTORY_DAYS = 365;

/**
 * Painel do proprietário — `/painel` (P4-06 · 04 §8.3 · 03 §1.2)
 * =========================================================================
 * Substitui o ecrã de verificação de Fase 1 que vivia em `/`. Owner-only, com
 * a mesma defesa em profundidade de `/propriedades`: o middleware já filtra,
 * confirma-se na mesma aqui (08 §7.3).
 *
 * Só lê o que a Fase 4 tem: `properties`, `property_views` e
 * `saved_properties`. Os blocos "Próximas visitas" e "Atividade recente" do
 * desenho ficam para as Fases 5 e 6, com as tabelas que lhes faltam.
 */
export default async function DashboardPage() {
  const supabase = createClient(await cookies());
  const [t, locale, { data: authData }] = await Promise.all([
    getTranslations(),
    getLocale(),
    supabase.auth.getUser(),
  ]);

  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "owner") redirect("/");

  const { data: properties } = await supabase
    .from("properties")
    .select("id, status")
    .eq("owner_id", user.id);

  const owned = properties ?? [];
  const ids = owned.map((property) => property.id);
  const activeCount = owned.filter(
    (property) => property.status === "active" || property.status === "featured",
  ).length;
  const draftCount = owned.filter((property) => property.status === "draft").length;

  const today = new Date();
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  // Sem imóveis não há nada a cruzar — poupa-se um `in ()` vazio ao Postgres.
  const [viewRows, savedCount] = ids.length
    ? await Promise.all([
        supabase
          .from("property_views")
          .select("day, views_count")
          .in("property_id", ids)
          .gte("day", since.toISOString().slice(0, 10))
          .then(({ data }) => (data ?? []) as ViewRow[]),
        supabase
          .from("saved_properties")
          .select("id", { count: "exact", head: true })
          .in("property_id", ids)
          .then(({ count }) => count ?? 0),
      ])
    : [[] as ViewRow[], 0];

  const week = weeklyViews(viewRows, today);

  const stats: DashboardStat[] = [
    {
      id: "active",
      icon: "building",
      label: "Imóveis ativos",
      value: String(activeCount),
      delta: activeCount === 0 ? "ainda sem anúncios publicados" : `${owned.length} no total`,
      deltaTone: activeCount === 0 ? "warn" : "muted",
    },
    {
      id: "views",
      icon: "eye",
      label: "Visitas às propriedades",
      value: week.total.toLocaleString("pt-PT"),
      delta: week.delta,
      deltaTone: week.tone,
    },
    {
      id: "saved",
      icon: "saved",
      label: "Guardados por compradores",
      value: String(savedCount),
      delta: savedCount === 0 ? "ainda sem interessados" : "em listas de compradores",
      deltaTone: savedCount === 0 ? "muted" : "ok",
    },
    {
      id: "drafts",
      icon: "draft",
      label: "Rascunhos",
      value: String(draftCount),
      delta: draftCount === 0 ? "nada por terminar" : "a aguardar para publicar",
      deltaTone: draftCount === 0 ? "muted" : "warn",
    },
  ];

  const firstName = (profile.full_name || "").split(/\s+/)[0] || "";

  return (
    <AppChrome
      role="owner"
      userName={profile.full_name || "Proprietário"}
      userMeta="Proprietário"
      activeId="dashboard"
      locale={locale}
      onLocaleChange={setLocalePreference}
    >
      <PageHeader
        title={t(`greeting.${greetingKey()}`, { name: firstName })}
        subtitle="Resumo da sua atividade e ativos"
        actions={
          <Button variant="secondary" disabled>
            {t("common.export")}
          </Button>
        }
      />
      <OwnerDashboard stats={stats} series={buildViewsSeries(viewRows, today)} />
    </AppChrome>
  );
}
