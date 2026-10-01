import { DashboardStats } from "./DashboardStats";
import { QuickAccess } from "./QuickAccess";
import { RecentActivity, type ActivityItem } from "./RecentActivity";
import { UpcomingVisits } from "./UpcomingVisits";
import { ViewsChart } from "./ViewsChart";
import type { DashboardStat, ViewsSeries } from "./dashboardTypes";
import type { VisitRow } from "../interaction/interactionTypes";

export type OwnerDashboardProps = {
  stats: DashboardStat[];
  series: ViewsSeries[];
  upcomingVisits: VisitRow[];
  recentMessages: ActivityItem[];
  recentMessagesMeta: string;
  recentContracts: ActivityItem[];
  recentContractsMeta: string;
};

/**
 * Painel do proprietário — 04 §8.3
 * =========================================================================
 * Os cinco blocos do desenho, agora completos (fecha **D23**): "As suas
 * estatísticas" → "Acesso rápido" → "Gráficos" → "Atividade recente".
 *
 * "Gráficos" é uma grelha de duas colunas, com o gráfico à esquerda e as
 * próximas visitas à direita — na Fase 4 o gráfico ocupava a largura toda
 * porque "Próximas visitas" dependia de `visit_requests`, que só existe agora.
 * As colunas são fluidas (`auto-fit` com mínimo de 340 px): abaixo disso
 * empilham sozinhas, sem ponto de quebra escrito à mão.
 *
 * Sem acesso ao Supabase de propósito: recebe tudo por prop, para o canvas de
 * demonstração poder montar o mesmo ecrã com dados fixos.
 */
export function OwnerDashboard({
  stats,
  series,
  upcomingVisits,
  recentMessages,
  recentMessagesMeta,
  recentContracts,
  recentContractsMeta,
}: OwnerDashboardProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-8)" }}>
      <DashboardStats stats={stats} />
      <QuickAccess />

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
        <h2
          style={{
            fontSize: "var(--fs-subtitle)",
            fontWeight: "var(--fw-bold)",
            color: "var(--text)",
            margin: 0,
          }}
        >
          Gráficos
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "var(--sp-7)",
            alignItems: "stretch",
          }}
        >
          <ViewsChart series={series} />
          <UpcomingVisits rows={upcomingVisits} />
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
        <h2
          style={{
            fontSize: "var(--fs-subtitle)",
            fontWeight: "var(--fw-bold)",
            color: "var(--text)",
            margin: 0,
          }}
        >
          Atividade recente
        </h2>
        <RecentActivity
          messages={recentMessages}
          messagesMeta={recentMessagesMeta}
          contracts={recentContracts}
          contractsMeta={recentContractsMeta}
        />
      </section>
    </div>
  );
}
