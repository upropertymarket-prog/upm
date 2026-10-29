import { NextIntlClientProvider } from "next-intl";
import { NoNavigation } from "../06 - proprietario/NoNavigation";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { PageHeader } from "../../../../packages/ui/src/shell/PageHeader";

import { AppChrome } from "../../../../apps/app/src/components/AppChrome";
import "../../_estilos/shell-no-canvas.css";
import { BuyerDashboard } from "../../../../apps/app/src/components/dashboard/BuyerDashboard";
import ptMessages from "../../../../packages/config/messages/pt.json";
import {
  demoBuyerStats,
  demoLocaleChange,
  demoNotifications,
  demoRecentContracts,
  demoRecentMessages,
  demoViewsSeries,
} from "./demo";

/**
 * `/painel` — Painel do comprador (04 §2.4 · fecha D33).
 *
 * É o `BuyerDashboard` verdadeiro, e não o `BuyerPanel`: o `BuyerPanel` é um
 * componente de **servidor** que resolve seis consultas ao Supabase antes de
 * renderizar. O canvas não tem sessão nem base de dados, por isso monta o que
 * a página monta depois de ter os dados — o mesmo contrato que o canvas do
 * proprietário usa com o `OwnerDashboard`.
 *
 * Os quatro blocos de 04 §2.4 estão todos: estatísticas, acesso rápido,
 * "Imóveis vistos" e atividade recente. A saudação vive no `PageHeader`, fora
 * do componente, como na página.
 *
 * O comprador não tem "Próximas visitas" ao lado do gráfico — isso é do painel
 * do proprietário (04 §8.3) —, por isso o gráfico ocupa a largura toda.
 *
 * O tema é fixado num `data-theme` próprio em vez de ser deixado ao
 * `ThemeProvider`, pela razão explicada no `Painel.tsx` do canvas 06: o
 * provider lê o `localStorage`, que é partilhado por todas as storyboards do
 * mesmo host, e sem isto bastava alguém carregar no alternador da topbar para
 * o par claro/escuro ficar igual.
 *
 * A saudação está fixa em "Boa tarde" em vez de `greetingKey()`: a chave
 * depende da hora do relógio e faria a storyboard render diferente conforme a
 * altura do dia.
 *
 * `liveNotifications={false}`: o sino lê `notifications` do Supabase em tempo
 * real, e aqui não há sessão — a lista fixa entra por prop.
 */
function PainelDemo({ theme }: { theme: "light" | "dark" }) {
  return (
    <div data-theme={theme} style={{ background: "var(--bg)", height: "900px" }}>
      <NoNavigation>
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
          <ThemeProvider initialChoice={theme}>
            <ToastProvider>
              <AppChrome
                role="buyer"
                userName="João Costa"
                userMeta="Comprador"
                activeId="dashboard"
                locale="pt"
                onLocaleChange={demoLocaleChange}
                counters={{ saved: 3, messages: 2, myRequests: 1, contracts: 1 }}
                notifications={demoNotifications}
                liveNotifications={false}
                appUpdates={false}
              >
                <PageHeader title="Boa tarde, João" subtitle="A sua procura, num só lugar" />
                <BuyerDashboard
                  stats={demoBuyerStats}
                  series={demoViewsSeries}
                  recentMessages={demoRecentMessages}
                  recentMessagesMeta="1 por responder"
                  recentContracts={demoRecentContracts}
                  recentContractsMeta="1 por assinar"
                />
              </AppChrome>
            </ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </NoNavigation>
    </div>
  );
}

export function CompradorPainelClaro() {
  return <PainelDemo theme="light" />;
}

export function CompradorPainelEscuro() {
  return <PainelDemo theme="dark" />;
}
