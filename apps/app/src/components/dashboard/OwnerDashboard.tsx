import { DashboardStats } from "./DashboardStats";
import { QuickAccess } from "./QuickAccess";
import { ViewsChart } from "./ViewsChart";
import type { DashboardStat, ViewsSeries } from "./dashboardTypes";

export type OwnerDashboardProps = {
  stats: DashboardStat[];
  series: ViewsSeries[];
};

/**
 * Painel do proprietário (P4-06) — 04 §8.3
 * =========================================================================
 * Três dos cinco blocos do desenho. Os outros dois — "Próximas visitas" e
 * "Atividade recente" (mensagens e contratos) — dependem de tabelas que
 * nascem nas Fases 5 e 6; entram aqui quando P5-01/P5-02 e P6-01 aterrarem,
 * e não antes: um bloco permanentemente vazio vale menos do que bloco nenhum.
 *
 * Sem acesso ao Supabase de propósito: recebe tudo por prop, para o canvas de
 * demonstração poder montar o mesmo ecrã com dados fixos.
 */
export function OwnerDashboard({ stats, series }: OwnerDashboardProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-8)" }}>
      <DashboardStats stats={stats} />
      <QuickAccess />
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
        <ViewsChart series={series} />
      </section>
    </div>
  );
}
