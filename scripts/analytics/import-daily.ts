#!/usr/bin/env tsx
/**
 * P8-06 — importa o tráfego do site para `site_analytics_daily` (04 §8.5, 05 §1.9).
 *
 * Uso:
 *   set -a && . .secrets/supabase.env && . .secrets/umami.env && set +a
 *   pnpm analytics:import                      # ontem, modo do site vindo da flag
 *   pnpm analytics:import --days 7             # os últimos 7 dias
 *   pnpm analytics:import --from 2026-09-01 --to 2026-09-30
 *   pnpm analytics:import --conversions-only   # sem fornecedor, só o que é nosso
 *                                              # (o pg_cron já o faz de hora a hora)
 *
 * Ontem e não hoje, de propósito: o dia em curso ainda está a acontecer, e
 * importá-lo grava um total que vai mudar. O `upsert` corrigi-lo-ia na corrida
 * seguinte, mas até lá a página mostra um número a menos sem o dizer.
 *
 * Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. O fornecedor
 * precisa de UMAMI_BASE_URL, UMAMI_WEBSITE_ID e UMAMI_API_KEY — que são
 * confirmação de produção (07 §16.1) e só existem no fim do projeto. Sem elas,
 * `--conversions-only` continua a funcionar: as conversões são nossas (07 §21.5).
 */
import {
  createAnalyticsStore,
  createUmamiProvider,
  importSiteAnalytics,
  umamiConfigFromEnv,
  type SiteMode,
} from "../../packages/db/src/analytics";
import { createServiceClient } from "../../packages/db/src/server";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function range(): { from: string; to: string } {
  const from = flag("from");
  const to = flag("to");
  if (from && to) return { from, to };

  const days = Math.max(1, Number(flag("days") ?? 1));
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1); // ontem
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { from: isoDate(start), to: isoDate(end) };
}

/**
 * O modo do site vem da flag de lançamento, não de um argumento: é a mesma
 * verdade que o site público usa para se desenhar (03 F14), e deixá-la ser
 * escolhida à mão na linha de comandos produziria dias etiquetados ao contrário.
 */
async function siteModeFromFlags(
  client: ReturnType<typeof createServiceClient>,
): Promise<SiteMode> {
  const { data } = await client
    .from("feature_flags")
    .select("value")
    .eq("key", "launch_mode")
    .maybeSingle();
  return data?.value === "post" ? "post" : "pre";
}

async function main() {
  const client = createServiceClient();
  const store = createAnalyticsStore(client);
  const siteMode = await siteModeFromFlags(client);
  const { from, to } = range();

  console.log(`Tráfego do site · ${from} a ${to} · modo ${siteMode}`);

  // As conversões não dependem do fornecedor: o pg_cron já as reconta de hora a
  // hora. Isto é a mesma recontagem, à mão — para intervalos fora da janela de 7
  // dias do cron. Só escreve `conversions`; as visitas que lá estejam ficam.
  if (process.argv.includes("--conversions-only")) {
    const { data, error } = await client.rpc("refresh_site_conversions", {
      p_from: from,
      p_to: to,
    });
    if (error) throw new Error(`Conversões: ${error.message}`);
    console.log(`  ${data ?? 0} linha(s) de conversões escritas, sem fornecedor.`);
    return;
  }

  const provider = createUmamiProvider(umamiConfigFromEnv());
  const report = await importSiteAnalytics(provider, store, { from, to, siteMode });

  console.log(`  ${report.provider}: ${report.days} dia(s), ${report.rows} linha(s).`);
  for (const failure of report.failures) {
    console.log(`  ✗ ${failure.date}: ${failure.reason}`);
  }
  if (report.failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
