import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
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
  loadLeads,
  loadNotifications,
  loadVisits,
} from "../../lib/interaction";
import { setLocalePreference } from "../actions/preferences";

export const dynamic = "force-dynamic";

/** Um ano de histórico chega para os três intervalos do gráfico. */
const HISTORY_DAYS = 365;

/** Quantas linhas cabem em cada painel de "Atividade recente" (04 §8.3). */
const ACTIVITY_ROWS = 3;

/**
 * Painel do proprietário — `/painel` (04 §8.3 · 03 §1.2)
 * =========================================================================
 * Os cinco blocos do desenho, completos — **fecha D23**. Os dois que faltavam
 * ("Próximas visitas" ao lado do gráfico, e "Atividade recente" por baixo)
 * dependiam de `visit_requests` e `conversations`, que nasceram nesta fase.
 *
 * Os KPIs voltaram aos quatro do desenho: 07 §5.8 renomeia o segundo para
 * "Visualizações dos imóveis" — visitas são as físicas (`visit_requests`),
 * visualizações são as consultas da página (`property_views`).
 *
 * Owner-only, com a mesma defesa em profundidade de `/propriedades`: o
 * middleware já filtra, confirma-se na mesma aqui (08 §7.3).
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
    .select("id, title, ref, status")
    .eq("owner_id", user.id);

  const owned = properties ?? [];
  const ids = owned.map((property) => property.id);
  const activeCount = owned.filter(
    (property) => property.status === "active" || property.status === "featured",
  ).length;

  const today = new Date();
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  // Sem imóveis não há nada a cruzar — poupa-se um `in ()` vazio ao Postgres.
  const viewRows: ViewRow[] = ids.length
    ? await supabase
        .from("property_views")
        .select("day, views_count")
        .in("property_id", ids)
        .gte("day", since.toISOString().slice(0, 10))
        .then(({ data }) => (data ?? []) as ViewRow[])
    : [];

  const [visits, conversations, leads, notifications] = await Promise.all([
    loadVisits(supabase),
    loadConversations(supabase),
    loadLeads(supabase),
    loadNotifications(supabase),
  ]);

  const week = weeklyViews(viewRows, today);

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

  const newLeads = leads.filter(
    (lead) => lead.stage === "new" || lead.stage === "contacted",
  ).length;
  const scheduled = visits.filter((visit) => visit.status === "accepted").length;
  const awaiting = visits.filter(
    (visit) => visit.status === "pending" || visit.status === "rescheduled",
  ).length;

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
      // 07 §5.8: "visualizações" são consultas da página; "visitas" são físicas.
      id: "views",
      icon: "eye",
      label: "Visualizações dos imóveis",
      value: week.total.toLocaleString("pt-PT"),
      delta: week.delta,
      deltaTone: week.tone,
    },
    {
      id: "leads",
      icon: "leads",
      label: "Leads novas",
      value: String(newLeads),
      delta: newLeads === 0 ? "ainda sem interessados" : "por contactar ou em conversa",
      deltaTone: newLeads === 0 ? "muted" : "ok",
    },
    {
      id: "visits",
      icon: "visits",
      label: "Visitas agendadas",
      value: String(scheduled),
      delta: awaiting === 0 ? "nenhuma por confirmar" : `${awaiting} por confirmar`,
      deltaTone: awaiting === 0 ? "muted" : "warn",
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

  const unansweredCount = conversations.filter((item) => item.unread > 0).length;

  // "Documentos e contratos": `property_documents` existe desde a Fase 2 e dá a
  // metade dos documentos. Os contratos entram com P6-03 — por isso o painel
  // diz "documentos" enquanto for só isso (07 §18 e D23).
  const documents = ids.length
    ? await supabase
        .from("property_documents")
        .select("id, name, kind, created_at, property_id")
        .in("property_id", ids)
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_ROWS)
        .then(({ data }) => data ?? [])
    : [];

  const titleOf = new Map(owned.map((item) => [item.id, item.title || item.ref]));
  const recentDocuments: ActivityItem[] = documents.map((doc) => ({
    id: doc.id,
    title: `${doc.name} · ${titleOf.get(doc.property_id) ?? "Imóvel"}`,
    subtitle: `anexado ${formatRelative(doc.created_at)}`,
    href: `/propriedades/${doc.property_id}/editar`,
    tag: "Documento",
    tone: "archived",
  }));

  const firstName = (profile.full_name || "").split(/\s+/)[0] || "";

  return (
    <AppChrome
      role="owner"
      userName={profile.full_name || "Proprietário"}
      userMeta="Proprietário"
      activeId="dashboard"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={countersFor("owner", conversations, visits, leads)}
      notifications={notifications}
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
      <OwnerDashboard
        stats={stats}
        series={buildViewsSeries(viewRows, today)}
        upcomingVisits={upcoming}
        recentMessages={recentMessages}
        recentMessagesMeta={
          unansweredCount === 0 ? "tudo respondido" : `${unansweredCount} por responder`
        }
        recentDocuments={recentDocuments}
        recentDocumentsMeta={
          documents.length === 0 ? "sem documentos" : `${documents.length} recentes`
        }
      />
    </AppChrome>
  );
}
