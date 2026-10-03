import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import {
  TrafficDashboard,
  type TrafficBreakdown,
  type TrafficPoint,
  type TrafficRange,
  type TrafficScope,
  type TrafficSummary,
} from "../../../../apps/interno/src/app/admin/trafego/TrafficDashboard";
import ptMessages from "../../../../packages/config/messages/pt.json";

/**
 * Tráfego do site — storyboards de P8-06 (04 §8.5).
 *
 * Renderiza o `TrafficDashboard` de produção com fixtures. O componente não
 * importa nada de `next/navigation` de propósito (a ligação ao router vive em
 * `TrafficView`), e é isso que o torna renderizável aqui: o canvas corre num
 * sidecar Vite, sem router do Next.
 *
 * Os números são os mesmos pesos do seed determinístico de
 * `seed_demo_site_analytics()`, para o storyboard e a página em staging contarem
 * a mesma história.
 */

const summary: TrafficSummary = {
  visits: 4_212,
  uniques: 3_285,
  conversions: 151,
  conversionRate: 0.0358,
  avgDurationS: 97,
  bounceRate: 0.54,
};

/** 30 dias com a onda do seed: menos tráfego ao fim de semana. */
const series: TrafficPoint[] = Array.from({ length: 30 }, (_, index) => {
  const day = new Date(Date.UTC(2026, 8, 3 + index));
  const weekend = [0, 6].includes(day.getUTCDay());
  const visits = 120 + ((index * 37) % 70) - (weekend ? 45 : 0);
  return {
    date: day.toISOString().slice(0, 10),
    visits,
    conversions: Math.max(0, Math.round(visits / 28)),
  };
});

const breakdown: TrafficBreakdown = {
  path: [
    { label: "/", visits: 1_938 },
    { label: "/precos", visits: 927 },
    { label: "/imoveis", visits: 674 },
    { label: "/pre-inscricao", visits: 463 },
    { label: "/termos", visits: 210 },
  ],
  source: [
    { label: "(direto)", visits: 1_727 },
    { label: "google.com", visits: 1_432 },
    { label: "facebook.com", visits: 632 },
    { label: "linkedin.com", visits: 421 },
  ],
  device: [
    { label: "mobile", visits: 2_443 },
    { label: "desktop", visits: 1_516 },
    { label: "tablet", visits: 253 },
  ],
  city: [
    { label: "Lisboa", visits: 1_601 },
    { label: "Porto", visits: 1_011 },
    { label: "Braga", visits: 590 },
    { label: "Faro", visits: 505 },
    { label: "(desconhecida)", visits: 505 },
  ],
};

function AdminTrafegoDemo({ theme }: { theme: "light" | "dark" }) {
  const [scope, setScope] = useState<TrafficScope>("pre");
  const [range, setRange] = useState<TrafficRange>(30);

  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="admin"
              userName="Helena Matos"
              userMeta="Administração · IT"
              activeId="siteTraffic"
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{ propertyModeration: 4, siteLeads: 12 }}
            >
              <TrafficDashboard
                locale="pt"
                scope={scope}
                range={range}
                summary={summary}
                series={series}
                breakdown={breakdown}
                onFilterChange={(next) => {
                  if (next.scope) setScope(next.scope);
                  if (next.range) setRange(next.range);
                }}
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

/** O estado vazio é o que o Admin vê hoje: o site público é de uma fase posterior. */
function AdminTrafegoVazioDemo({ theme }: { theme: "light" | "dark" }) {
  const [scope, setScope] = useState<TrafficScope>("all");
  const [range, setRange] = useState<TrafficRange>(7);

  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="admin"
              userName="Helena Matos"
              userMeta="Administração · IT"
              activeId="siteTraffic"
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{ propertyModeration: 4, siteLeads: 12 }}
            >
              <TrafficDashboard
                locale="pt"
                scope={scope}
                range={range}
                summary={{
                  visits: 0,
                  uniques: 0,
                  conversions: 0,
                  conversionRate: 0,
                  avgDurationS: 0,
                  bounceRate: 0,
                }}
                series={[]}
                breakdown={{ path: [], source: [], device: [], city: [] }}
                onFilterChange={(next) => {
                  if (next.scope) setScope(next.scope);
                  if (next.range) setRange(next.range);
                }}
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function AdminTrafegoClaro() {
  return <AdminTrafegoDemo theme="light" />;
}

export function AdminTrafegoEscuro() {
  return <AdminTrafegoDemo theme="dark" />;
}

export function AdminTrafegoVazio() {
  return <AdminTrafegoVazioDemo theme="light" />;
}

export function AdminTrafegoVazioEscuro() {
  return <AdminTrafegoVazioDemo theme="dark" />;
}
