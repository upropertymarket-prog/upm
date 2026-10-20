import { useTranslations } from "next-intl";
import { DashboardStats } from "./DashboardStats";
import { QuickAccess } from "./QuickAccess";
import { RecentActivity, type ActivityItem } from "./RecentActivity";
import { ViewsChart } from "./ViewsChart";
import type { DashboardStat, ViewsSeries } from "./dashboardTypes";

export type BuyerDashboardProps = {
  stats: DashboardStat[];
  /** "Imóveis vistos" — a série de `my_property_views_daily` (D45). */
  series: ViewsSeries[];
  recentMessages: ActivityItem[];
  recentMessagesMeta: string;
  recentContracts: ActivityItem[];
  recentContractsMeta: string;
};

/**
 * Painel do comprador — `/painel` para `role = buyer` (04 §2.4 · fecha D33)
 * =========================================================================
 * 04 §2.4 dá-lhe quatro blocos: saudação, estatísticas (guardados, visitas,
 * conversas, documentos), acesso rápido (Market, Guardados, Pedidos de
 * visitas, Mensagens) e atividade recente. Estão cá os quatro — a saudação no
 * `PageHeader` da página, como no painel do proprietário.
 *
 * O gráfico "Imóveis vistos" é alimentado por `my_property_views_daily`
 * (D45). Até 6 out 2026 não existia maneira de o desenhar: `property_views` é
 * agregado por imóvel e por dia, sem coluna de quem viu — por desenho, desde
 * 05 §1.2. O registo por utilizador foi decidido nesse dia, depois de ficar
 * claro que é dado pessoal: append-only, 90 dias, purga diária, e cada pessoa
 * só vê o seu. O que não se fez foi trocar a métrica por outra que já tivesse
 * dados: chamar "Imóveis vistos" a outra coisa era o que a decisão de D29 já
 * tinha recusado.
 *
 * Sem acesso ao Supabase, como o `OwnerDashboard`: tudo entra por prop, para o
 * canvas poder montar o mesmo ecrã com dados fixos.
 */
export function BuyerDashboard({
  stats,
  series,
  recentMessages,
  recentMessagesMeta,
  recentContracts,
  recentContractsMeta,
}: BuyerDashboardProps) {
  const t = useTranslations("dashboard");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-8)" }}>
      <DashboardStats stats={stats} />
      <QuickAccess role="buyer" />

      {/* "Imóveis vistos" (04 §2.4). O comprador não tem "Próximas visitas"
          ao lado — isso é do painel do proprietário (04 §8.3) —, por isso o
          gráfico ocupa a largura toda em vez de deixar meia coluna vazia. */}
      <ViewsChart series={series} title={t("viewedTitle")} />

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
        <h2
          style={{
            fontSize: "var(--fs-subtitle)",
            fontWeight: "var(--fw-bold)",
            color: "var(--text)",
            margin: 0,
          }}
        >
          {t("recentActivity")}
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
