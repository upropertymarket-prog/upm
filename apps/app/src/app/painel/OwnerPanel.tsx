import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { CONTRACT_STATUS_TONES } from "@upm/db/cloud";
import { INTL_LOCALE, resolveLocale } from "@upm/config";
import { createClient } from "@upm/db/server";
import { Button, PageHeader, greetingKey } from "@upm/ui";

import { AppChrome } from "../../components/AppChrome";
import { OwnerDashboard } from "../../components/dashboard/OwnerDashboard";
import type { ActivityItem } from "../../components/dashboard/RecentActivity";
import type { DashboardStat } from "../../components/dashboard/dashboardTypes";
import { formatRelative } from "../../components/interaction/interactionTypes";
import { buildViewsSeries, weeklyViews, type ViewRow } from "../../lib/dashboard";
import {
  countersFor,
  loadConversations,
  loadDashboardCounts,
  loadLeads,
  loadNotifications,
  loadVisits,
} from "../../lib/interaction";
import { setLocalePreference } from "../actions/preferences";
import { ACTIVITY_ROWS } from "./panelShared";

/** Um ano de histórico chega para os três intervalos do gráfico. */
const HISTORY_DAYS = 365;

/**
 * Painel do proprietário — `/painel` com `role = owner` (04 §8.3 · 03 §1.2)
 * =========================================================================
 * Os cinco blocos do desenho, completos — **fecha D23**. Os dois que faltavam
 * ("Próximas visitas" ao lado do gráfico, e "Atividade recente" por baixo)
 * dependiam de `visit_requests` e `conversations`, que nasceram na Fase 5.
 *
 * Os KPIs voltaram aos quatro do desenho: 07 §5.8 renomeia o segundo para
 * "Visualizações dos imóveis" — visitas são as físicas (`visit_requests`),
 * visualizações são as consultas da página (`property_views`).
 *
 * Vivia no `page.tsx` até o Painel do comprador existir (D33). Agora a rota é
 * um encaminhador por papel e cada painel tem o seu ficheiro — o guard de
 * papel continua a ser feito lá, antes de chegar aqui.
 */
export async function OwnerPanel({
  userId,
  fullName,
  locale,
}: {
  userId: string;
  fullName: string;
  locale: string;
}) {
  const supabase = createClient(await cookies());
  const t = await getTranslations();
  const intlLocale = INTL_LOCALE[resolveLocale(locale)];
  const tRoles = await getTranslations("roles");
  const tDash = await getTranslations("dashboard");
  const tStat = await getTranslations("dashboard.stats");
  const tAct = await getTranslations("dashboard.activity");
  const chartLabels = {
    locale: intlLocale,
    t: await getTranslations("dashboard.chart"),
  };
  const tStatus = await getTranslations("contracts.status");
  const tActivity = await getTranslations("contracts.activity");

  const { data: properties } = await supabase
    .from("properties")
    .select("id, title, ref, status")
    .eq("owner_id", userId);

  const owned = properties ?? [];
  const ids = owned.map((property) => property.id);
  const activeCount = owned.filter(
    (property) => property.status === "active" || property.status === "featured",
  ).length;

  const today = new Date();

  // Somadas por dia na base. Até 3 nov vinha uma linha por imóvel por dia e
  // somava-se aqui: com 34 imóveis, 30 dias passam das 1000 linhas que o
  // PostgREST devolve, e o gráfico mostrava menos visitas do que as reais.
  // Sem imóveis não há nada a somar — poupa-se o pedido.
  const viewRows: ViewRow[] = ids.length
    ? await supabase
        .rpc("my_owned_property_views_daily", { p_days: HISTORY_DAYS })
        .then(({ data }) => (data ?? []) as ViewRow[])
    : [];

  const [visits, conversations, leads, notifications, counts] = await Promise.all([
    loadVisits(supabase),
    loadConversations(supabase),
    loadLeads(supabase),
    loadNotifications(supabase, locale),
    loadDashboardCounts(supabase),
  ]);

  const week = weeklyViews(viewRows, today, chartLabels);

  // "Próximas visitas": só o que ainda está para acontecer, do mais próximo
  // para o mais distante — o oposto da ordem da Agenda, que mostra histórico.
  const upcoming = visits
    .filter(
      (visit) =>
        new Date(visit.proposedAt) >= today &&
        (visit.status === "pending" ||
          visit.status === "accepted" ||
          visit.status === "rescheduled"),
    )
    .sort((a, b) => a.proposedAt.localeCompare(b.proposedAt))
    .slice(0, ACTIVITY_ROWS);

  const newLeads = counts.newLeads;
  const scheduled = counts.visitsAccepted;
  const awaiting = counts.visitsAwaiting;

  const stats: DashboardStat[] = [
    {
      id: "active",
      icon: "building",
      label: tStat("activeLabel"),
      value: String(activeCount),
      delta:
        activeCount === 0 ? tStat("activeNone") : tStat("activeTotal", { count: owned.length }),
      deltaTone: activeCount === 0 ? "warn" : "muted",
    },
    {
      // 07 §5.8: "visualizações" são consultas da página; "visitas" são físicas.
      id: "views",
      icon: "eye",
      label: tStat("viewsLabel"),
      value: week.total.toLocaleString(intlLocale),
      delta: week.delta,
      deltaTone: week.tone,
    },
    {
      id: "leads",
      icon: "leads",
      label: tStat("leadsLabel"),
      value: String(newLeads),
      delta: newLeads === 0 ? tStat("leadsNone") : tStat("leadsSome"),
      deltaTone: newLeads === 0 ? "muted" : "ok",
    },
    {
      id: "visits",
      icon: "visits",
      label: tStat("visitsLabel"),
      value: String(scheduled),
      delta:
        awaiting === 0 ? tStat("visitsNoneAwaiting") : tStat("visitsAwaiting", { count: awaiting }),
      deltaTone: awaiting === 0 ? "muted" : "warn",
    },
  ];

  const recentMessages: ActivityItem[] = conversations.slice(0, ACTIVITY_ROWS).map((item) => ({
    id: item.id,
    title: `${item.other.name} · ${item.propertyTitle}`,
    subtitle: item.lastMessage ? `«${item.lastMessage}»` : tAct("emptyConversation"),
    href: `/mensagens?conversa=${item.id}`,
    tag: item.unread > 0 ? tAct("new") : tAct("read"),
    tone: item.unread > 0 ? "new" : "archived",
  }));

  const unansweredCount = counts.conversationsUnread;

  // "Contratos" — fecha **D29**. O painel chamava-se "Documentos e contratos" e
  // mostrava só `property_documents`; por decisão do cliente (30 set 2026)
  // passa a mostrar contratos, que é o que P6-03 traz e o que faz de facto
  // sentido num painel de atividade recente. Os documentos do imóvel saem
  // daqui: vivem no imóvel e na Cloud (07 §19.5 e §19.12).
  //
  // `my_contracts()` e não um select: a RLS de `properties` e de `profiles` não
  // deixa alcançar o título do imóvel nem o nome da contraparte por join — é o
  // mesmo padrão de `my_conversations` (07 §19, nota de leitura da Fase 5).
  const { data: contractRows } = await supabase.rpc("my_contracts");
  const contracts = (contractRows ?? []).slice(0, ACTIVITY_ROWS);

  const recentContracts: ActivityItem[] = contracts.map((row) => ({
    id: row.id,
    title: row.property_title ? `${row.title} · ${row.property_title}` : row.title,
    subtitle: row.counterparty_name
      ? tActivity("withCounterparty", {
          name: row.counterparty_name,
          when: formatRelative(row.updated_at, intlLocale),
        })
      : formatRelative(row.updated_at, intlLocale),
    href: `/contratos/${row.id}`,
    tag: tStatus(row.status),
    tone: CONTRACT_STATUS_TONES[row.status] as ActivityItem["tone"],
  }));

  const firstName = (fullName || "").split(/\s+/)[0] || "";

  return (
    <AppChrome
      role="owner"
      userName={fullName || tRoles("owner")}
      userMeta={tRoles("owner")}
      activeId="dashboard"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={countersFor("owner", conversations, visits, leads)}
      notifications={notifications}
    >
      <PageHeader
        title={t(`greeting.${greetingKey()}`, { name: firstName })}
        subtitle={tDash("ownerSubtitle")}
        actions={
          <Button variant="secondary" disabled>
            {t("common.export")}
          </Button>
        }
      />
      <OwnerDashboard
        stats={stats}
        series={buildViewsSeries(viewRows, today, chartLabels)}
        upcomingVisits={upcoming}
        recentMessages={recentMessages}
        recentMessagesMeta={
          unansweredCount === 0
            ? tAct("allAnswered")
            : tAct("unanswered", { count: unansweredCount })
        }
        recentContracts={recentContracts}
        recentContractsMeta={
          contracts.length === 0
            ? tAct("noContracts")
            : tAct("recentContracts", { count: contracts.length })
        }
      />
    </AppChrome>
  );
}
