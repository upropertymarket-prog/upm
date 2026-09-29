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
 * A saudação está fixa em "Boa tarde" em vez de `greetingKey()`: a chave
 * depende da hora do relógio e faria a storyboard render diferente conforme a
 * altura do dia. Ver `demo.ts` para a mesma razão nos baldes do gráfico.
 */
export default function Painel() {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ThemeProvider initialChoice="light">
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
  );
}
