import { describe, expect, it, vi } from "vitest";

import {
  DIRECT_SOURCE,
  UNKNOWN_CITY,
  buildAnalyticsRows,
  conversionKey,
  createUmamiProvider,
  importSiteAnalytics,
  listDates,
  umamiConfigFromEnv,
  type AnalyticsProvider,
  type AnalyticsRow,
  type AnalyticsStore,
  type DailyTraffic,
} from "./analytics";

function traffic(overrides: Partial<DailyTraffic> = {}): DailyTraffic {
  return {
    totals: { date: "2026-10-01", visits: 100, uniques: 80, avgDurationS: 64, bounces: 50 },
    dimensions: [],
    ...overrides,
  };
}

function totalRow(rows: AnalyticsRow[]): AnalyticsRow {
  const found = rows.find((r) => !r.path && !r.source && !r.device && !r.city);
  if (!found) throw new Error("sem linha de totais");
  return found;
}

describe("granularidade das linhas (migração 20261002120400)", () => {
  it("produz uma linha de totais com as quatro dimensões vazias", () => {
    const rows = buildAnalyticsRows({ siteMode: "pre", traffic: traffic(), conversions: 7 });
    const total = totalRow(rows);

    expect(total).toMatchObject({
      date: "2026-10-01",
      site_mode: "pre",
      path: "",
      source: "",
      device: "",
      city: "",
      visits: 100,
      uniques: 80,
      conversions: 7,
      bounces: 50,
    });
  });

  it("cada linha de dimensão tem exatamente uma preenchida e só visitas", () => {
    const rows = buildAnalyticsRows({
      siteMode: "pre",
      conversions: 7,
      traffic: traffic({
        dimensions: [
          { date: "2026-10-01", dimension: "path", label: "/precos", visits: 40 },
          { date: "2026-10-01", dimension: "city", label: "Lisboa", visits: 25 },
        ],
      }),
    });

    const dimensionRows = rows.filter((r) => r !== totalRow(rows));
    expect(dimensionRows).toHaveLength(2);

    for (const row of dimensionRows) {
      const filled = [row.path, row.source, row.device, row.city].filter(Boolean);
      expect(filled, JSON.stringify(row)).toHaveLength(1);
      // A constraint `..._dimension_rows_carry_visits_only` recusaria o contrário.
      expect(row.uniques).toBe(0);
      expect(row.conversions).toBe(0);
      expect(row.avg_duration_s).toBe(0);
      expect(row.bounces).toBe(0);
    }
  });

  it("as conversões entram só na linha de totais", () => {
    const rows = buildAnalyticsRows({
      siteMode: "post",
      conversions: 9,
      traffic: traffic({
        dimensions: [{ date: "2026-10-01", dimension: "device", label: "mobile", visits: 60 }],
      }),
    });

    expect(rows.filter((r) => r.conversions > 0)).toHaveLength(1);
    expect(totalRow(rows).conversions).toBe(9);
  });

  it("soma rótulos repetidos na mesma dimensão, em vez de colidir na chave única", () => {
    const rows = buildAnalyticsRows({
      siteMode: "pre",
      conversions: 0,
      traffic: traffic({
        dimensions: [
          { date: "2026-10-01", dimension: "source", label: "google.com", visits: 30 },
          { date: "2026-10-01", dimension: "source", label: " google.com ", visits: 12 },
        ],
      }),
    });

    const sources = rows.filter((r) => r.source);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.visits).toBe(42);
  });

  it("ignora rótulos vazios e dimensões a zero", () => {
    const rows = buildAnalyticsRows({
      siteMode: "pre",
      conversions: 0,
      traffic: traffic({
        dimensions: [
          { date: "2026-10-01", dimension: "path", label: "   ", visits: 10 },
          { date: "2026-10-01", dimension: "path", label: "/vazio", visits: 0 },
        ],
      }),
    });

    expect(rows).toHaveLength(1); // só a linha de totais
  });

  it("não deixa passar números negativos nem fracionários", () => {
    const rows = buildAnalyticsRows({
      siteMode: "pre",
      conversions: -3,
      traffic: traffic({
        totals: { date: "2026-10-01", visits: -5, uniques: 7.6, avgDurationS: 64.4, bounces: 0 },
      }),
    });

    const total = totalRow(rows);
    expect(total.visits).toBe(0);
    expect(total.conversions).toBe(0);
    expect(total.uniques).toBe(8);
    expect(total.avg_duration_s).toBe(64);
  });
});

describe("listDates", () => {
  it("inclui os dois extremos", () => {
    expect(listDates("2026-10-01", "2026-10-03")).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });

  it("recusa intervalo invertido, inválido e demasiado longo", () => {
    expect(() => listDates("2026-10-03", "2026-10-01")).toThrow(/invertido/);
    expect(() => listDates("ontem", "2026-10-01")).toThrow(/inválido/);
    expect(() => listDates("2020-01-01", "2026-10-01")).toThrow(/demasiado longo/);
  });
});

describe("importSiteAnalytics", () => {
  function fakeStore(): AnalyticsStore & { written: AnalyticsRow[] } {
    const written: AnalyticsRow[] = [];
    return {
      written,
      async conversions() {
        return new Map([[conversionKey("2026-10-02", "pre"), 5]]);
      },
      async upsert(rows) {
        written.push(...rows);
      },
    };
  }

  it("liga as conversões ao dia certo e deixa os outros a zero", async () => {
    const provider: AnalyticsProvider = {
      name: "fake",
      fetchDay: async (date) => traffic({ totals: { ...traffic().totals, date } }),
    };
    const store = fakeStore();

    const report = await importSiteAnalytics(provider, store, {
      from: "2026-10-01",
      to: "2026-10-03",
      siteMode: "pre",
    });

    expect(report.days).toBe(3);
    expect(report.failures).toHaveLength(0);

    const byDate = new Map(store.written.map((r) => [r.date, r.conversions]));
    expect(byDate.get("2026-10-02")).toBe(5);
    expect(byDate.get("2026-10-01")).toBe(0);
  });

  it("um dia que falha não leva os outros atrás", async () => {
    const provider: AnalyticsProvider = {
      name: "fake",
      fetchDay: async (date) => {
        if (date === "2026-10-02") throw new Error("502 do fornecedor");
        return traffic({ totals: { ...traffic().totals, date } });
      },
    };
    const store = fakeStore();

    const report = await importSiteAnalytics(provider, store, {
      from: "2026-10-01",
      to: "2026-10-03",
      siteMode: "pre",
    });

    expect(report.days).toBe(2);
    expect(report.failures).toEqual([{ date: "2026-10-02", reason: "502 do fornecedor" }]);
    expect(store.written.some((r) => r.date === "2026-10-03")).toBe(true);
  });
});

describe("fornecedor Umami", () => {
  const config = {
    baseUrl: "https://analytics.example.com",
    websiteId: "site-1",
    apiKey: "k",
  };

  function stubFetch(responses: Record<string, unknown>) {
    return vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const type = url.searchParams.get("type");
      const key = url.pathname.endsWith("/stats") ? "stats" : `metrics:${type}`;
      return {
        ok: true,
        status: 200,
        json: async () => responses[key] ?? [],
      } as Response;
    });
  }

  it("traduz stats e métricas nas nossas colunas", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({
        stats: {
          visits: { value: 200 },
          visitors: { value: 150 },
          bounces: { value: 90 },
          totaltime: { value: 12_000 },
        },
        "metrics:url": [{ x: "/", y: 120 }],
        "metrics:referrer": [{ x: "", y: 80 }],
        "metrics:device": [{ x: "mobile", y: 140 }],
        "metrics:city": [{ x: null, y: 30 }],
      }),
    );

    const day = await createUmamiProvider(config).fetchDay("2026-10-01");

    expect(day.totals).toEqual({
      date: "2026-10-01",
      visits: 200,
      uniques: 150,
      bounces: 90,
      avgDurationS: 60, // 12 000 s / 200 visitas
    });

    // Referenciador e cidade vazios não podem virar `''`, que está reservado
    // para "a linha não é desta dimensão".
    expect(day.dimensions).toContainEqual({
      date: "2026-10-01",
      dimension: "source",
      label: DIRECT_SOURCE,
      visits: 80,
    });
    expect(day.dimensions).toContainEqual({
      date: "2026-10-01",
      dimension: "city",
      label: UNKNOWN_CITY,
      visits: 30,
    });

    vi.unstubAllGlobals();
  });

  it("um campo que o fornecedor renomeie dá erro, não um NaN silencioso", async () => {
    vi.stubGlobal("fetch", stubFetch({ stats: { pageviews: { value: 10 } } }));
    await expect(createUmamiProvider(config).fetchDay("2026-10-01")).rejects.toThrow();
    vi.unstubAllGlobals();
  });

  it("recusa URL que não seja https, e endereços privados (08 §7.4)", () => {
    expect(() => createUmamiProvider({ ...config, baseUrl: "http://exemplo.pt" })).toThrow(/https/);
    expect(() => createUmamiProvider({ ...config, baseUrl: "https://10.0.0.5" })).toThrow(
      /privado/,
    );
    expect(() => createUmamiProvider({ ...config, baseUrl: "https://169.254.169.254" })).toThrow(
      /privado/,
    );
    // localhost continua a servir desenvolvimento.
    expect(() =>
      createUmamiProvider({ ...config, baseUrl: "http://localhost:3000" }),
    ).not.toThrow();
  });

  it("sem credenciais, a razão é legível e diz onde se resolve", () => {
    expect(() => umamiConfigFromEnv({} as NodeJS.ProcessEnv)).toThrow(/UMAMI_BASE_URL/);
    expect(() => umamiConfigFromEnv({} as NodeJS.ProcessEnv)).toThrow(/16\.1/);
  });
});
