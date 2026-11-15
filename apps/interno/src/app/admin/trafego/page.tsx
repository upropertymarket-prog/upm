import { cookies } from "next/headers";
import { createClient } from "@upm/db/server";

import { InternalChrome } from "../../../components/InternalChrome";
import { setLocalePreference } from "../../actions/preferences";
import type {
  TrafficBreakdown,
  TrafficPoint,
  TrafficRange,
  TrafficScope,
  TrafficSummary,
} from "./TrafficDashboard";
import { TrafficView } from "./TrafficView";
import { getAdminShellData } from "../../../lib/admin-shell";

export const dynamic = "force-dynamic";

const RANGES: TrafficRange[] = [7, 30, 90];
const SCOPES: TrafficScope[] = ["all", "pre", "post"];

/** O filtro vem do URL, logo vem do utilizador — valida-se contra listas fechadas. */
function parseFilters(params: Record<string, string | string[] | undefined>) {
  const rawScope = Array.isArray(params.scope) ? params.scope[0] : params.scope;
  const rawRange = Array.isArray(params.range) ? params.range[0] : params.range;

  const scope = SCOPES.includes(rawScope as TrafficScope) ? (rawScope as TrafficScope) : "all";
  const range = RANGES.includes(Number(rawRange) as TrafficRange)
    ? (Number(rawRange) as TrafficRange)
    : 30;

  return { scope, range };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Tráfego do site — `/admin/trafego` (P8-06 · 04 §8.5)
 * =========================================================================
 * Três chamadas agregadas, sempre três, independentemente de quantos dias,
 * caminhos e cidades existirem na tabela (08 §4.5). Os quatro cartões vêm numa
 * só — `admin_site_traffic_breakdown` devolve a dimensão como coluna, para não
 * serem quatro viagens à base de dados a desenhar quatro cartões que aparecem ao
 * mesmo tempo.
 */
export default async function TrafficPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { scope, range } = parseFilters(await searchParams);
  const supabase = createClient(await cookies());

  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (range - 1));

  // "Todo o site" omite o argumento em vez de passar null: o `default null` da
  // função é o que significa "sem filtro", e os tipos gerados não aceitam null.
  const args = {
    p_from: isoDate(from),
    p_to: isoDate(to),
    ...(scope === "all" ? {} : { p_site_mode: scope }),
  };

  const [shell, summaryResult, seriesResult, breakdownResult, latestResult] = await Promise.all([
    getAdminShellData(supabase),
    supabase.rpc("admin_site_traffic_summary", args),
    supabase.rpc("admin_site_traffic_series", args),
    supabase.rpc("admin_site_traffic_breakdown", { ...args, p_limit: 8 }),
    // O dia mais recente gravado, em qualquer modo: diz se a importação corre.
    supabase
      .from("site_analytics_daily")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const totals = summaryResult.data?.[0];
  const summary: TrafficSummary = {
    visits: Number(totals?.visits ?? 0),
    uniques: Number(totals?.uniques ?? 0),
    conversions: Number(totals?.conversions ?? 0),
    conversionRate: Number(totals?.conversion_rate ?? 0),
    avgDurationS: Number(totals?.avg_duration_s ?? 0),
    bounceRate: Number(totals?.bounce_rate ?? 0),
  };

  const series: TrafficPoint[] = (seriesResult.data ?? []).map((row) => ({
    date: String(row.date),
    visits: Number(row.visits),
    conversions: Number(row.conversions),
  }));

  const breakdown: TrafficBreakdown = { path: [], source: [], device: [], city: [] };
  for (const row of breakdownResult.data ?? []) {
    const bucket = breakdown[row.dimension as keyof TrafficBreakdown];
    if (bucket) bucket.push({ label: row.label, visits: Number(row.visits) });
  }

  return (
    <InternalChrome
      role="admin"
      userName={shell.userName}
      userMeta={shell.userMeta}
      activeId="siteTraffic"
      locale={shell.locale}
      onLocaleChange={setLocalePreference}
      counters={shell.counters}
    >
      <TrafficView
        locale={shell.locale}
        scope={scope}
        range={range}
        summary={summary}
        series={series}
        breakdown={breakdown}
        lastDataDate={latestResult.data?.date ? String(latestResult.data.date) : null}
      />
    </InternalChrome>
  );
}
