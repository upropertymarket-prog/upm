import { describe, expect, it } from "vitest";

import ptMessages from "@upm/config/messages/pt.json";

import { buildViewsSeries, weeklyViews, type ViewRow } from "./dashboard";

/** 29 de setembro de 2026, uma terça-feira. */
const TODAY = new Date(Date.UTC(2026, 8, 29));

function rows(...entries: [string, number][]): ViewRow[] {
  return entries.map(([day, views_count]) => ({ day, views_count }));
}

/** Os baldes de um intervalo — falha com uma mensagem útil se o id mudar. */
function bucketsOf(id: string, viewRows: ViewRow[]) {
  const series = buildViewsSeries(viewRows, TODAY, LABELS).find((s) => s.id === id);
  if (!series) throw new Error(`intervalo "${id}" não existe`);
  return series.buckets;
}

/**
 * Os rótulos saem do `pt.json` de verdade, não de um duplo inventado: assim as
 * asserções continuam a ler-se em português — "+20% esta semana" — **e** o
 * teste cai se alguém apagar a chave. A interpolação é a mínima que estas
 * chaves precisam (`{x}`), não um ICU completo.
 */
const CHART = ptMessages.dashboard.chart as Record<string, string>;
const LABELS = {
  locale: "pt-PT",
  t: (key: string, values?: Record<string, string | number>) =>
    Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, String(value)),
      CHART[key] ?? key,
    ),
};

describe("buildViewsSeries", () => {
  it("dá sempre os três intervalos, pela ordem do seletor", () => {
    const series = buildViewsSeries([], TODAY, LABELS);
    expect(series.map((s) => s.id)).toEqual(["7d", "30d", "12m"]);
    expect(series.map((s) => s.buckets.length)).toEqual([7, 4, 12]);
  });

  it("põe o dia de hoje no último balde dos 7 dias", () => {
    const week = bucketsOf("7d", rows(["2026-09-29", 42]));
    expect(week.at(-1)).toMatchObject({ value: 42 });
    expect(week.slice(0, -1).every((b) => b.value === 0)).toBe(true);
  });

  it("soma várias linhas do mesmo dia — uma por imóvel", () => {
    const week = bucketsOf("7d", rows(["2026-09-29", 10], ["2026-09-29", 5], ["2026-09-29", 1]));
    expect(week.at(-1)?.value).toBe(16);
  });

  it("ignora dias fora da janela", () => {
    expect(bucketsOf("7d", rows(["2026-09-20", 999])).every((b) => b.value === 0)).toBe(true);
  });

  it("agrupa 30 dias em quatro semanas de sete dias", () => {
    // 23 de setembro cai na última semana; 16 de setembro na penúltima.
    const month = bucketsOf("30d", rows(["2026-09-23", 4], ["2026-09-16", 7]));
    expect(month.map((b) => b.value)).toEqual([0, 0, 7, 4]);
  });

  it("agrupa 12 meses por mês de calendário e termina no mês corrente", () => {
    const year = bucketsOf("12m", rows(["2026-09-01", 3], ["2026-09-30", 2], ["2025-10-15", 8]));
    expect(year.at(-1)?.value).toBe(5);
    expect(year.at(0)?.value).toBe(8);
  });
});

describe("weeklyViews", () => {
  it("compara os últimos 7 dias com os 7 anteriores", () => {
    const result = weeklyViews(rows(["2026-09-29", 120], ["2026-09-20", 100]), TODAY, LABELS);
    expect(result.total).toBe(120);
    expect(result.delta).toBe("+20% esta semana");
    expect(result.tone).toBe("ok");
  });

  it("marca uma descida como aviso", () => {
    const result = weeklyViews(rows(["2026-09-29", 50], ["2026-09-20", 100]), TODAY, LABELS);
    expect(result.delta).toBe("-50% esta semana");
    expect(result.tone).toBe("warn");
  });

  it("não divide por zero quando não há semana anterior", () => {
    expect(weeklyViews(rows(["2026-09-29", 10]), TODAY, LABELS)).toMatchObject({
      total: 10,
      delta: "primeira semana com visitas",
      tone: "ok",
    });
    expect(weeklyViews([], TODAY, LABELS)).toMatchObject({
      total: 0,
      delta: "sem visitas esta semana",
      tone: "muted",
    });
  });
});
