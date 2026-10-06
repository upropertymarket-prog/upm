import { DashboardStats } from "./DashboardStats";
import { QuickAccess } from "./QuickAccess";
import { RecentActivity, type ActivityItem } from "./RecentActivity";
import type { DashboardStat } from "./dashboardTypes";

export type BuyerDashboardProps = {
  stats: DashboardStat[];
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
 * **O gráfico "Imóveis vistos" não está** e isso é deliberado: não existe
 * registo de que imóveis uma pessoa viu. `property_views` é agregado por
 * imóvel e por dia (`property_id, day, views_count`), sem coluna de quem viu —
 * por desenho, desde 05 §1.2. Desenhá-lo exigiria uma tabela nova de eventos
 * por utilizador, que é dado pessoal com retenção a decidir; inventar aqui um
 * gráfico com outra métrica era chamar "Imóveis vistos" a outra coisa, que é
 * precisamente o que a decisão de D29 recusou. Fica como a parte não paga de
 * D33, com a decisão por tomar registada no doc 10.
 *
 * Sem acesso ao Supabase, como o `OwnerDashboard`: tudo entra por prop, para o
 * canvas poder montar o mesmo ecrã com dados fixos.
 */
export function BuyerDashboard({
  stats,
  recentMessages,
  recentMessagesMeta,
  recentContracts,
  recentContractsMeta,
}: BuyerDashboardProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-8)" }}>
      <DashboardStats stats={stats} />
      <QuickAccess role="buyer" />

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
