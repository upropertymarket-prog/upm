/**
 * Agregação das visitas do Painel (P4-06)
 * =========================================================================
 * `property_views` é diária e por imóvel (05 §1.2). O Painel mostra o total do
 * proprietário em três intervalos, por isso a soma por balde faz-se aqui, em
 * memória, a partir das linhas já filtradas por dono pela RLS.
 *
 * Funções puras e com `today` injetável — é o que as torna testáveis sem
 * congelar o relógio, e o que impede o gráfico de flutuar no canvas.
 */
import type { ViewsBucket, ViewsSeries } from "../components/dashboard/dashboardTypes";

export type ViewRow = {
  /** `date` do Postgres, em ISO (`2026-09-29`). */
  day: string;
  views_count: number;
};

const WEEKDAY = new Intl.DateTimeFormat("pt-PT", { weekday: "short" });
const MONTH = new Intl.DateTimeFormat("pt-PT", { month: "short" });
const FULL_DAY = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long" });
const FULL_MONTH = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" });

/** "seg." → "seg" — o eixo não quer o ponto que o Intl acrescenta. */
function trimDot(value: string): string {
  return value.replace(/\.$/, "");
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Soma por dia, para não percorrer as linhas uma vez por balde. */
function indexByDay(rows: ViewRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.day, (totals.get(row.day) ?? 0) + Number(row.views_count));
  }
  return totals;
}

/** Os últimos 7 dias, um balde por dia, a terminar em `today`. */
function lastSevenDays(totals: Map<string, number>, today: Date): ViewsBucket[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    return {
      label: trimDot(WEEKDAY.format(date)),
      value: totals.get(toKey(date)) ?? 0,
      srLabel: FULL_DAY.format(date),
    };
  });
}

/** Quatro semanas de 7 dias, a última a terminar em `today`. */
function lastFourWeeks(totals: Map<string, number>, today: Date): ViewsBucket[] {
  return Array.from({ length: 4 }, (_, index) => {
    const end = addDays(today, (index - 3) * 7);
    const start = addDays(end, -6);
    let value = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      value += totals.get(toKey(addDays(start, offset))) ?? 0;
    }
    return {
      label: `s${index + 1}`,
      value,
      srLabel: `Semana de ${FULL_DAY.format(start)} a ${FULL_DAY.format(end)}`,
    };
  });
}

/** Doze meses de calendário, o último o mês de `today`. */
function lastTwelveMonths(rows: ViewRow[], today: Date): ViewsBucket[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = row.day.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + Number(row.views_count));
  }

  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (11 - index), 1),
    );
    return {
      label: trimDot(MONTH.format(date)),
      value: totals.get(toKey(date).slice(0, 7)) ?? 0,
      srLabel: FULL_MONTH.format(date),
    };
  });
}

/** As três séries do seletor, pela ordem em que aparecem no gráfico. */
export function buildViewsSeries(rows: ViewRow[], today: Date): ViewsSeries[] {
  const daily = indexByDay(rows);
  return [
    { id: "7d", label: "7 dias", buckets: lastSevenDays(daily, today) },
    { id: "30d", label: "30 dias", buckets: lastFourWeeks(daily, today) },
    { id: "12m", label: "12 meses", buckets: lastTwelveMonths(rows, today) },
  ];
}

/**
 * Total dos últimos 7 dias e variação face aos 7 anteriores — a linha de
 * contexto do KPI "Visitas às propriedades".
 */
export function weeklyViews(
  rows: ViewRow[],
  today: Date,
): { total: number; delta: string; tone: "ok" | "warn" | "muted" } {
  const daily = indexByDay(rows);
  const sum = (from: number, to: number) => {
    let value = 0;
    for (let offset = from; offset <= to; offset += 1) {
      value += daily.get(toKey(addDays(today, offset))) ?? 0;
    }
    return value;
  };

  const current = sum(-6, 0);
  const previous = sum(-13, -7);

  if (previous === 0) {
    return {
      total: current,
      delta: current === 0 ? "sem visitas esta semana" : "primeira semana com visitas",
      tone: current === 0 ? "muted" : "ok",
    };
  }

  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return { total: current, delta: "igual à semana passada", tone: "muted" };
  return {
    total: current,
    delta: `${change > 0 ? "+" : ""}${change}% esta semana`,
    tone: change > 0 ? "ok" : "warn",
  };
}
