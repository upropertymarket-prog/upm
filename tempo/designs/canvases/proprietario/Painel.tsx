import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { PageHeader } from "../../../../packages/ui/src/shell/PageHeader";
import { Button } from "../../../../packages/ui/src/components/Button";

import { AppChrome } from "../../../../apps/app/src/components/AppChrome";
import { OwnerDashboard } from "../../../../apps/app/src/components/dashboard/OwnerDashboard";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { demoDashboardStats, demoLocaleChange, demoViewsSeries } from "./demo";

/**
 * `/painel` — Painel do proprietário (P4-06 · 04 §8.3).
 *
 * O tema é fixado num `data-theme` próprio em vez de ser deixado ao
 * `ThemeProvider`: o provider, no primeiro efeito do cliente, lê o
 * `data-theme-choice` do documento e o `localStorage`, e essas duas coisas são
 * partilhadas por todas as storyboards do mesmo host. Sem isto, bastava
 * alguém carregar no alternador de tema da topbar para as duas storyboards
 * ficarem iguais. Como `tokens.css` seleciona por `[data-theme="dark"]` — e
 * não por `:root[data-theme="dark"]` — o atributo funciona em qualquer
 * elemento e as variáveis herdam a partir dele.
 *
 * O `ThemeProvider` continua a envolver o conteúdo porque a topbar precisa do
 * contexto para o alternador existir; é só a cor que deixa de depender dele.
 *
 * A saudação está fixa em "Boa tarde" em vez de `greetingKey()`: a chave
 * depende da hora do relógio e faria a storyboard render diferente conforme a
 * altura do dia. Ver `demo.ts` para a mesma razão nos baldes do gráfico.
 */
function PainelDemo({ theme }: { theme: "light" | "dark" }) {
  return (
    <div data-theme={theme} style={{ background: "var(--bg)", height: "900px" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <AppChrome
            role="owner"
            userName="Ana Silva"
            userMeta="Proprietária · Premium"
            activeId="dashboard"
            locale="pt"
            onLocaleChange={demoLocaleChange}
            counters={{ leads: 9, messages: 3, visitSchedule: 3, contracts: 1 }}
          >
            <PageHeader
              title="Boa tarde, Ana"
              subtitle="Resumo da sua atividade e ativos"
              actions={
                <Button variant="secondary" disabled>
                  Exportar
                </Button>
              }
            />
            <OwnerDashboard stats={demoDashboardStats} series={demoViewsSeries} />
          </AppChrome>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export default function Painel() {
  return <PainelDemo theme="light" />;
}

export function PainelEscuro() {
  return <PainelDemo theme="dark" />;
}
