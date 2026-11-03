/**
 * Tráfego do site — acesso e agregações (Fase 8, P8-06)
 * =========================================================================
 * Fecha para `site_analytics_daily` a exigência de 08 §2.3 ("uma linha nova na
 * matriz por cada tabela nova") e prova as duas coisas que a tabela tem de
 * garantir e que nenhum teste unitário alcança:
 *
 * 1. **Ninguém escreve a partir de uma sessão.** É uma tabela de importação, não
 *    um formulário (08 §3.5).
 * 2. **Os KPIs não contam cada visita quatro vezes.** É o defeito de
 *    granularidade que a migração `20261002120400` corrige, e é invisível a olho:
 *    um total quadruplicado é plausível.
 *
 * Precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e
 * SUPABASE_SERVICE_ROLE_KEY no ambiente — sem eles salta (D6/D13).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listarTodosOsUtilizadores } from "./test-users";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const PASSWORD = "analytics-rls-test-P@ss1";
const USERS = {
  admin: { email: "analytics-admin@upropertymarket.test", role: "admin" },
  support: { email: "analytics-support@upropertymarket.test", role: "support" },
  owner: { email: "analytics-owner@upropertymarket.test", role: "owner" },
  buyer: { email: "analytics-buyer@upropertymarket.test", role: "buyer" },
} as const;

type Who = keyof typeof USERS;

/** Um dia bem no passado, para não colidir com os 45 dias do seed. */
const DAY = "2024-03-05";

/** As RPC chegam sem tipo: o cliente de teste é genérico, de propósito. */
type SeriesRow = { date: string; visits: number; conversions: number };
type BreakdownRow = { dimension: string; label: string; visits: number };
const RANGE = { p_from: "2024-03-01", p_to: "2024-03-31", p_site_mode: "pre" };

describe.skipIf(!hasEnv)("Tráfego do site — acesso e agregações (Fase 8)", () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  const clients = {} as Record<Who, SupabaseClient>;
  const ids = {} as Record<Who, string>;

  async function user(email: string, role: string) {
    const list = await listarTodosOsUtilizadores(service);
    const found = list.data.users.find((u) => u.email === email);
    if (found) return found.id;
    const created = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role },
    });
    if (created.error || !created.data.user) {
      throw new Error(`Falha a criar ${email}: ${created.error?.message}`);
    }
    return created.data.user.id;
  }

  beforeAll(async () => {
    service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    anon = createClient(SUPABASE_URL!, ANON_KEY!);

    for (const key of Object.keys(USERS) as Who[]) {
      const { email, role } = USERS[key];
      ids[key] = await user(email, role);
      await service.from("profiles").update({ role }).eq("id", ids[key]);
      const client = createClient(SUPABASE_URL!, ANON_KEY!);
      const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
      if (error) throw new Error(`Falha a autenticar ${email}: ${error.message}`);
      clients[key] = client;
    }

    // Um dia controlado: 100 visitas, 10 conversões, e as quatro dimensões a
    // somar 100 cada — exatamente a forma em que um total ingénuo daria 500.
    //
    // Todas as onze colunas vão explícitas em todas as linhas, e não por
    // omissão: **num insert em lote, o PostgREST alinha as linhas ao mesmo
    // conjunto de colunas**, e uma coluna que falte numa linha vai como `null`
    // em vez de cair no `DEFAULT ''`. É por isso que `buildAnalyticsRows`
    // também as escreve sempre todas.
    const row = (over: Partial<Record<string, string | number>>) => ({
      date: DAY,
      site_mode: "pre",
      path: "",
      source: "",
      device: "",
      city: "",
      visits: 0,
      uniques: 0,
      conversions: 0,
      avg_duration_s: 0,
      bounces: 0,
      ...over,
    });

    await service.from("site_analytics_daily").delete().eq("date", DAY);
    const seeded = await service
      .from("site_analytics_daily")
      .insert([
        row({ visits: 100, uniques: 70, conversions: 10, avg_duration_s: 60, bounces: 40 }),
        row({ path: "/", visits: 60 }),
        row({ path: "/precos", visits: 40 }),
        row({ source: "(direto)", visits: 100 }),
        row({ device: "mobile", visits: 100 }),
        row({ city: "Lisboa", visits: 100 }),
      ]);

    // Uma fixture que falha em silêncio é pior do que falhar (lição do D13).
    if (seeded.error) throw new Error(`Fixture de tráfego: ${seeded.error.message}`);
  });

  afterAll(async () => {
    if (!hasEnv) return;
    await service.from("site_analytics_daily").delete().eq("date", DAY);
  });

  // -------------------------------------------------------------------------
  // Matriz de acesso — 08 §2.3
  // -------------------------------------------------------------------------

  it("só o staff lê a tabela", async () => {
    for (const who of ["admin", "support"] as Who[]) {
      const { data } = await clients[who].from("site_analytics_daily").select("id").eq("date", DAY);
      expect(data?.length ?? 0, who).toBeGreaterThan(0);
    }

    for (const who of ["owner", "buyer"] as Who[]) {
      const { data } = await clients[who].from("site_analytics_daily").select("id").eq("date", DAY);
      expect(data?.length ?? 0, who).toBe(0);
    }

    const { data: anonRows } = await anon.from("site_analytics_daily").select("id");
    expect(anonRows?.length ?? 0).toBe(0);
  });

  it("nenhuma sessão escreve — nem o admin (08 §3.5)", async () => {
    for (const who of ["admin", "support", "owner", "buyer"] as Who[]) {
      const insert = await clients[who]
        .from("site_analytics_daily")
        .insert({ date: DAY, site_mode: "pre", path: "/forjado", visits: 999 });
      expect(insert.error, `insert ${who}`).not.toBeNull();

      const update = await clients[who]
        .from("site_analytics_daily")
        .update({ visits: 1 })
        .eq("date", DAY)
        .select("id");
      expect(update.error !== null || update.data?.length === 0, `update ${who}`).toBe(true);

      const remove = await clients[who]
        .from("site_analytics_daily")
        .delete()
        .eq("date", DAY)
        .select("id");
      expect(remove.error !== null || remove.data?.length === 0, `delete ${who}`).toBe(true);
    }

    const anonInsert = await anon
      .from("site_analytics_daily")
      .insert({ date: DAY, site_mode: "pre", path: "/forjado-anon", visits: 999 })
      .select("id");
    expect(anonInsert.error ?? anonInsert.data?.length, "insert anon").toBeTruthy();

    const anonUpdate = await anon
      .from("site_analytics_daily")
      .update({ visits: 1 })
      .eq("date", DAY)
      .select("id");
    expect(anonUpdate.error ?? anonUpdate.data?.length, "update anon").toBeTruthy();

    const anonDelete = await anon
      .from("site_analytics_daily")
      .delete()
      .eq("date", DAY)
      .select("id");
    expect(anonDelete.error ?? anonDelete.data?.length, "delete anon").toBeTruthy();

    const { data: after } = await service
      .from("site_analytics_daily")
      .select("visits")
      .eq("date", DAY)
      .eq("path", "")
      .eq("source", "")
      .eq("device", "")
      .eq("city", "")
      .single();
    expect(Number(after!.visits)).toBe(100);
  });

  it("as funções de leitura recusam quem não é staff", async () => {
    for (const who of ["owner", "buyer"] as Who[]) {
      for (const fn of [
        "admin_site_traffic_summary",
        "admin_site_traffic_series",
        "admin_site_traffic_breakdown",
        "site_conversions_daily",
      ]) {
        const { error } = await clients[who].rpc(fn, RANGE);
        expect(error, `${who} → ${fn}`).not.toBeNull();
      }
    }

    expect((await anon.rpc("admin_site_traffic_summary", RANGE)).error).not.toBeNull();
  });

  it("a função de seed de demonstração não é chamável por uma sessão", async () => {
    const { error } = await clients.admin.rpc("seed_demo_site_analytics", { p_days: 1 });
    expect(error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // O defeito de granularidade — a razão de ser da migração 20261002120400
  // -------------------------------------------------------------------------

  it("o resumo lê só a linha de totais: 100 visitas, não 500", async () => {
    const { data, error } = await clients.admin.rpc("admin_site_traffic_summary", RANGE);
    expect(error).toBeNull();

    const row = data![0]!;
    expect(Number(row.visits)).toBe(100);
    expect(Number(row.uniques)).toBe(70);
    expect(Number(row.conversions)).toBe(10);
    expect(Number(row.conversion_rate)).toBeCloseTo(0.1, 4);
    expect(Number(row.bounce_rate)).toBeCloseTo(0.4, 4);
    expect(Number(row.avg_duration_s)).toBeCloseTo(60, 1);
  });

  it("a série do gráfico também, e as conversões nunca passam as visitas", async () => {
    const { data } = await clients.admin.rpc("admin_site_traffic_series", RANGE);
    const point = ((data ?? []) as SeriesRow[]).find((row) => String(row.date) === DAY);
    expect(point).toBeDefined();
    expect(Number(point!.visits)).toBe(100);
    expect(Number(point!.conversions)).toBe(10);
    expect(Number(point!.conversions)).toBeLessThanOrEqual(Number(point!.visits));
  });

  it("os cartões leem só as linhas de dimensão, e cada dimensão fecha nas 100", async () => {
    const { data } = await clients.admin.rpc("admin_site_traffic_breakdown", {
      ...RANGE,
      p_limit: 20,
    });

    const byDimension = new Map<string, number>();
    for (const row of (data ?? []) as BreakdownRow[]) {
      byDimension.set(row.dimension, (byDimension.get(row.dimension) ?? 0) + Number(row.visits));
    }

    expect(byDimension.get("path")).toBe(100);
    expect(byDimension.get("source")).toBe(100);
    expect(byDimension.get("device")).toBe(100);
    expect(byDimension.get("city")).toBe(100);

    // A linha de totais não entra em nenhum cartão — se entrasse, apareceria
    // como um rótulo vazio.
    expect(((data ?? []) as BreakdownRow[]).some((row) => !row.label)).toBe(false);
  });

  it("p_limit corta cada dimensão e nunca devolve a coleção inteira (08 §3.4)", async () => {
    const { data } = await clients.admin.rpc("admin_site_traffic_breakdown", {
      ...RANGE,
      p_limit: 1,
    });
    const paths = ((data ?? []) as BreakdownRow[]).filter((row) => row.dimension === "path");
    expect(paths).toHaveLength(1);
    expect(paths[0]!.label).toBe("/"); // o maior primeiro
  });

  // -------------------------------------------------------------------------
  // As guardas de escrita — para o adaptador não poder enganar-se em silêncio
  // -------------------------------------------------------------------------

  it("uma linha com duas dimensões preenchidas é recusada", async () => {
    const { error } = await service
      .from("site_analytics_daily")
      .insert({ date: DAY, site_mode: "pre", path: "/", city: "Lisboa", visits: 5 });
    expect(error).not.toBeNull();
  });

  it("uma linha de dimensão com únicos ou rejeições é recusada", async () => {
    const { error } = await service
      .from("site_analytics_daily")
      .insert({ date: DAY, site_mode: "pre", device: "tablet", visits: 5, uniques: 3 });
    expect(error).not.toBeNull();
  });

  it("escrever o mesmo dia duas vezes não duplica (chave única)", async () => {
    const row = { date: DAY, site_mode: "pre", path: "/precos", visits: 41 };
    await service
      .from("site_analytics_daily")
      .upsert(row, { onConflict: "date,site_mode,path,source,device,city" });
    await service
      .from("site_analytics_daily")
      .upsert(row, { onConflict: "date,site_mode,path,source,device,city" });

    const { data } = await service
      .from("site_analytics_daily")
      .select("id, visits")
      .eq("date", DAY)
      .eq("path", "/precos");
    expect(data).toHaveLength(1);
    expect(Number(data![0]!.visits)).toBe(41);
  });

  it("site_mode fora de pre|post é recusado", async () => {
    const { error } = await service
      .from("site_analytics_daily")
      .insert({ date: DAY, site_mode: "talvez", visits: 1 });
    expect(error).not.toBeNull();
  });
});
