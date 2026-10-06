import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONES } from "@upm/db/cloud";
import { createClient } from "@upm/db/server";
import { PageHeader, greetingKey } from "@upm/ui";

import { AppChrome } from "../../components/AppChrome";
import { BuyerDashboard } from "../../components/dashboard/BuyerDashboard";
import type { ActivityItem } from "../../components/dashboard/RecentActivity";
import type { DashboardStat } from "../../components/dashboard/dashboardTypes";
import { formatRelative } from "../../components/interaction/interactionTypes";
import {
  countersFor,
  loadConversations,
  loadNotifications,
  loadVisits,
} from "../../lib/interaction";
import { setLocalePreference } from "../actions/preferences";
import { ACTIVITY_ROWS } from "./panelShared";

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
 * O gráfico "Imóveis vistos" não entra, e o `BuyerDashboard` explica porquê:
 * não há registo por utilizador de que imóveis foram vistos.
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

  const [savedCount, visits, conversations, notifications, { data: contractRows }] =
    await Promise.all([
      supabase
        .from("saved_properties")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .then(({ count }) => count ?? 0),
      loadVisits(supabase),
      loadConversations(supabase),
      loadNotifications(supabase),
      supabase.rpc("my_contracts"),
    ]);

  const contractsAll = contractRows ?? [];
  const contracts = contractsAll.slice(0, ACTIVITY_ROWS);

  const scheduled = visits.filter((visit) => visit.status === "accepted").length;
  const awaiting = visits.filter(
    (visit) => visit.status === "pending" || visit.status === "rescheduled",
  ).length;
  const unansweredCount = conversations.filter((item) => item.unread > 0).length;

  const stats: DashboardStat[] = [
    {
      id: "saved",
      icon: "saved",
      label: "Imóveis guardados",
      value: String(savedCount),
      delta: savedCount === 0 ? "ainda sem imóveis guardados" : "na sua lista",
      deltaTone: savedCount === 0 ? "muted" : "ok",
    },
    {
      id: "visits",
      icon: "visits",
      label: "Visitas pedidas",
      value: String(visits.length),
      delta:
        visits.length === 0
          ? "ainda sem pedidos"
          : awaiting === 0
            ? `${scheduled} confirmadas`
            : `${awaiting} à espera de resposta`,
      deltaTone: visits.length === 0 ? "muted" : awaiting === 0 ? "ok" : "warn",
    },
    {
      id: "messages",
      icon: "messages",
      label: "Conversas",
      value: String(conversations.length),
      delta:
        conversations.length === 0
          ? "ainda sem conversas"
          : unansweredCount === 0
            ? "tudo lido"
            : `${unansweredCount} com mensagens novas`,
      deltaTone: conversations.length === 0 ? "muted" : unansweredCount === 0 ? "ok" : "warn",
    },
    {
      id: "contracts",
      icon: "contracts",
      label: "Contratos",
      value: String(contractsAll.length),
      delta: contractsAll.length === 0 ? "nenhum partilhado consigo" : "partilhados consigo",
      deltaTone: contractsAll.length === 0 ? "muted" : "ok",
    },
  ];

  const recentMessages: ActivityItem[] = conversations.slice(0, ACTIVITY_ROWS).map((item) => ({
    id: item.id,
    title: `${item.other.name} · ${item.propertyTitle}`,
    subtitle: item.lastMessage ? `«${item.lastMessage}»` : "Conversa aberta, ainda sem mensagens",
    href: `/mensagens?conversa=${item.id}`,
    tag: item.unread > 0 ? "Novo" : "Lido",
    tone: item.unread > 0 ? "new" : "archived",
  }));

  const recentContracts: ActivityItem[] = contracts.map((row) => ({
    id: row.id,
    title: row.property_title ? `${row.title} · ${row.property_title}` : row.title,
    subtitle: row.counterparty_name
      ? `com ${row.counterparty_name} · ${formatRelative(row.updated_at)}`
      : formatRelative(row.updated_at),
    href: `/contratos/${row.id}`,
    tag: CONTRACT_STATUS_LABELS[row.status],
    tone: CONTRACT_STATUS_TONES[row.status] as ActivityItem["tone"],
  }));

  const firstName = (fullName || "").split(/\s+/)[0] || "";

  return (
    <AppChrome
      role="buyer"
      userName={fullName || "Comprador"}
      userMeta="Comprador"
      activeId="dashboard"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={countersFor("buyer", conversations, visits, [])}
      notifications={notifications}
    >
      <PageHeader
        title={t(`greeting.${greetingKey()}`, { name: firstName })}
        subtitle="A sua procura, num só lugar"
      />
      <BuyerDashboard
        stats={stats}
        recentMessages={recentMessages}
        recentMessagesMeta={unansweredCount === 0 ? "tudo lido" : `${unansweredCount} por ler`}
        recentContracts={recentContracts}
        recentContractsMeta={
          contractsAll.length === 0 ? "sem contratos" : `${contracts.length} recentes`
        }
      />
    </AppChrome>
  );
}
