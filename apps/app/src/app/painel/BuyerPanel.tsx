import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { CONTRACT_STATUS_TONES } from "@upm/db/cloud";
import { INTL_LOCALE, resolveLocale } from "@upm/config";
import { createClient } from "@upm/db/server";
import { PageHeader, greetingKey } from "@upm/ui";

import { AppChrome } from "../../components/AppChrome";
import { BuyerDashboard } from "../../components/dashboard/BuyerDashboard";
import type { ActivityItem } from "../../components/dashboard/RecentActivity";
import type { DashboardStat } from "../../components/dashboard/dashboardTypes";
import { formatRelative } from "../../components/interaction/interactionTypes";
import {
  loadNavCounters,
  loadConversations,
  loadDashboardCounts,
  loadNotifications,
  loadVisits,
} from "../../lib/interaction";
import { buildViewsSeries } from "../../lib/dashboard";
import { setLocalePreference } from "../actions/preferences";
import { ACTIVITY_ROWS } from "./panelShared";

/** Um ano de histórico cobre os três intervalos do gráfico (a retenção corta aos 90 dias). */
const HISTORY_DAYS = 365;

/**
 * Painel do comprador — `/painel` com `role = buyer` (04 §2.4 · fecha D33)
 * =========================================================================
 * Até aqui `/painel` era owner-only e o middleware mandava o comprador para a
 * raiz — com "Painel" no topo da própria sidebar dele (`BUYER_NAV`), ou seja,
 * um item de navegação que não levava a nada.
 *
 * Os quatro KPIs são os de 04 §2.4: guardados, visitas, conversas e
 * documentos. "Documentos" são os **contratos** partilhados com esta pessoa —
 * a mesma leitura que fechou D29 no painel do proprietário: os documentos do
 * imóvel vivem no imóvel e na Cloud (07 §19.5), e o que um painel de atividade
 * tem para dizer é o contrato que mudou de estado.
 *
 * O gráfico "Imóveis vistos" entra com `my_property_views_daily` (D45): o
 * registo por utilizador nasceu na migração `20261006120100`, com retenção de
 * 90 dias por decisão do cliente. Antes disso não existia maneira de saber que
 * imóveis uma pessoa tinha visto — `property_views` é agregado por imóvel.
 */
export async function BuyerPanel({
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

  const [
    savedCount,
    visits,
    conversations,
    notifications,
    { data: contractRows },
    { data: views },
    counts,
    navCounters,
  ] = await Promise.all([
    supabase
      .from("saved_properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .then(({ count }) => count ?? 0),
    loadVisits(supabase),
    loadConversations(supabase),
    loadNotifications(supabase, locale),
    supabase.rpc("my_contracts"),
    supabase.rpc("my_property_views_daily", { p_days: HISTORY_DAYS }),
    loadDashboardCounts(supabase),
    loadNavCounters(supabase, "buyer"),
  ]);

  const contractsAll = contractRows ?? [];
  const contracts = contractsAll.slice(0, ACTIVITY_ROWS);

  // Contados na base, não sobre as listas (cortadas às 1000) — ver `loadDashboardCounts`.
  const scheduled = counts.visitsAccepted;
  const awaiting = counts.visitsAwaiting;
  const unansweredCount = counts.conversationsUnread;

  const stats: DashboardStat[] = [
    {
      id: "saved",
      icon: "saved",
      label: tStat("savedLabel"),
      value: String(savedCount),
      delta: savedCount === 0 ? tStat("savedNone") : tStat("savedSome"),
      deltaTone: savedCount === 0 ? "muted" : "ok",
    },
    {
      id: "visits",
      icon: "visits",
      label: tStat("requestedLabel"),
      value: String(visits.length),
      delta:
        visits.length === 0
          ? tStat("requestedNone")
          : awaiting === 0
            ? tStat("requestedConfirmed", { count: scheduled })
            : tStat("requestedWaiting", { count: awaiting }),
      deltaTone: visits.length === 0 ? "muted" : awaiting === 0 ? "ok" : "warn",
    },
    {
      id: "messages",
      icon: "messages",
      label: tStat("chatsLabel"),
      value: String(conversations.length),
      delta:
        conversations.length === 0
          ? tStat("chatsNone")
          : unansweredCount === 0
            ? tStat("chatsAllRead")
            : tStat("chatsUnread", { count: unansweredCount }),
      deltaTone: conversations.length === 0 ? "muted" : unansweredCount === 0 ? "ok" : "warn",
    },
    {
      id: "contracts",
      icon: "contracts",
      label: tStat("contractsLabel"),
      value: String(contractsAll.length),
      delta: contractsAll.length === 0 ? tStat("contractsNone") : tStat("contractsSome"),
      deltaTone: contractsAll.length === 0 ? "muted" : "ok",
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
      role="buyer"
      userName={fullName || tRoles("buyer")}
      userMeta={tRoles("buyer")}
      activeId="dashboard"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={navCounters}
      notifications={notifications}
    >
      <PageHeader
        title={t(`greeting.${greetingKey()}`, { name: firstName })}
        subtitle={tDash("buyerSubtitle")}
      />
      <BuyerDashboard
        stats={stats}
        series={buildViewsSeries(views ?? [], new Date(), chartLabels)}
        recentMessages={recentMessages}
        recentMessagesMeta={
          unansweredCount === 0 ? tAct("allRead") : tAct("unread", { count: unansweredCount })
        }
        recentContracts={recentContracts}
        recentContractsMeta={
          contractsAll.length === 0
            ? tAct("noContracts")
            : tAct("recentContracts", { count: contracts.length })
        }
      />
    </AppChrome>
  );
}
