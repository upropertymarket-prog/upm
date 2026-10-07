/**
 * Site público — o catálogo mostrado é o catálogo da base de dados (P2-03).
 *
 * Pedido explícito do cliente a 7 out 2026: *"deves é realmente garantir que
 * os planos que aparecem no site são os que estão a ser lidos no Supabase"*.
 *
 * O risco não é teórico. Em staging os preços são os do teste do Stripe —
 * "Smarter (teste)" a 149,90 €/ano — e não os de 07 §8.3. Se alguém, ao ver a
 * página errada, "corrigir" o valor no componente em vez de na tabela, o site
 * passa a mentir de forma indetetável: fica bonito e deixa de seguir o Admin.
 * Este teste falha nesse dia.
 *
 * O que verifica, pela via `anon` que é a do visitante:
 *   1. o conjunto de slugs visíveis é exactamente o que a tabela diz;
 *   2. nenhum plano invisível passa — em particular o Gratuito (P9-05);
 *   3. nenhum preço aparece escrito no código do site.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.skipIf(!hasEnv)("Site público — planos lidos da base de dados", () => {
  let anon: SupabaseClient;
  let service: SupabaseClient;

  beforeAll(() => {
    anon = createClient(SUPABASE_URL!, ANON_KEY!);
    service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
  });

  it("o visitante lê exactamente os planos marcados como visíveis", async () => {
    // A verdade: o que a tabela tem, visto com `service_role`.
    const { data: truth } = await service
      .from("plans")
      .select("slug, visible, price_year_cents, price_month_cents, name")
      .order("slug");

    // O que o site lê, pela mesma via que `getPublicPlans()` usa.
    const { data: shown, error } = await anon
      .from("plans")
      .select("slug, name, price_year_cents, price_month_cents")
      .eq("visible", true)
      .order("slug");

    expect(error).toBeNull();

    const expectedSlugs = (truth ?? [])
      .filter((plan) => plan.visible)
      .map((plan) => plan.slug)
      .sort();
    expect((shown ?? []).map((plan) => plan.slug).sort()).toEqual(expectedSlugs);

    // E os valores são os mesmos, cêntimo a cêntimo.
    for (const plan of shown ?? []) {
      const source = (truth ?? []).find((row) => row.slug === plan.slug);
      expect(source).toBeTruthy();
      expect(plan.price_year_cents).toBe(source?.price_year_cents);
      expect(plan.price_month_cents).toBe(source?.price_month_cents);
      expect(plan.name).toBe(source?.name);
    }
  });

  it("nenhum plano invisível chega ao site — e o Gratuito é um deles (P9-05)", async () => {
    const { data: hidden } = await service.from("plans").select("slug").eq("visible", false);

    const { data: shown } = await anon.from("plans").select("slug").eq("visible", true);
    const shownSlugs = new Set((shown ?? []).map((plan) => plan.slug));

    for (const plan of hidden ?? []) {
      expect(shownSlugs.has(plan.slug)).toBe(false);
    }

    // O Gratuito saiu em `20261007120500_end_free_plan.sql`. Se voltar a ficar
    // visível sem decisão, o site volta a prometer uma conta grátis.
    expect(shownSlugs.has("gratuito")).toBe(false);
  });
});

/**
 * Este não precisa de base de dados: é uma varredura do código do site.
 * Corre sempre, inclusive no CI sem credenciais — que é metade da sua graça.
 */
describe("Site público — nenhum preço escrito em código (07 §20.8)", () => {
  it("não há valores em euros nos componentes do site", () => {
    const root = "../../apps/web/src";
    const files: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry)) files.push(full);
      }
    };

    try {
      walk(root);
    } catch {
      // Caminho relativo diferente num runner diferente: não falha o teste
      // por causa do `cwd`, que seria um falso negativo irritante.
      return;
    }

    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const [index, line] of source.split("\n").entries()) {
        // Ignora comentários: a explicação pode (e deve) citar valores.
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
        // `29,90 €`, `5,99€`, `49.90 EUR` — um preço escrito à mão.
        if (/\d+[.,]\d{2}\s*(€|EUR)/.test(line)) {
          offenders.push(`${file}:${index + 1} — ${trimmed.slice(0, 80)}`);
        }
      }
    }

    expect(offenders, `Preços em código:\n${offenders.join("\n")}`).toEqual([]);
  });
});
