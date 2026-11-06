import { unstable_cache } from "next/cache";
import { SITE_CACHE_TAGS } from "@upm/config/site-cache-tags";
import { createAnonClient } from "@upm/db/server";

import type { PlanLimits, PublicPlan } from "../components/site/Pricing";

/**
 * O catálogo público de planos (P2-03 · 07 §20.8)
 * =========================================================================
 * **`visible = true` e mais nada.** É o filtro que o cliente confirmou a 7 out
 * 2026, e é também o que mantém o degrau Gratuito fora da página sem este
 * código precisar de saber que ele existiu: `20261007120500_end_free_plan.sql`
 * pôs `visible = false`, e a consulta passa ao lado.
 *
 * Nenhum preço, nome ou funcionalidade está escrito em código — 07 §20.8. O
 * que o site mostra é o que o Admin tem em *Planos*, e a página de preços
 * muda sem deploy.
 *
 * Cache de 5 minutos com tag própria: o catálogo muda raramente, e quando
 * muda o Admin pode invalidar pela mesma rota de revalidação do `launch_mode`.
 */

export const PLANS_TAG = SITE_CACHE_TAGS.plans;

type PlanRow = {
  slug: string;
  name: string;
  audience: string;
  price_year_cents: number | null;
  price_month_cents: number | null;
  features: string[] | null;
  limits: PlanLimits | null;
  position: number | null;
};

function toPublicPlan(row: PlanRow, index: number, total: number): PublicPlan {
  return {
    slug: row.slug,
    name: row.name,
    // O enum da base de dados é `owner | buyer | both`; qualquer outra coisa
    // seria dado corrompido, e `both` é a leitura segura — mostra em ambas as
    // escadas em vez de desaparecer sem explicação.
    audience: row.audience === "owner" || row.audience === "buyer" ? row.audience : "both",
    priceYearCents: row.price_year_cents ?? 0,
    priceMonthCents: row.price_month_cents ?? 0,
    features: row.features ?? [],
    limits: row.limits ?? {},
    // O do meio, quando há três; o último, quando há dois. É a convenção do
    // protótipo (o `tone: 'accent'` cai sempre no plano intermédio/topo) sem
    // precisar de uma coluna nova na tabela.
    highlighted: total >= 3 ? index === 1 : index === total - 1,
  };
}

const read = unstable_cache(
  async (): Promise<PublicPlan[]> => {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("plans")
      .select(
        "slug, name, audience, price_year_cents, price_month_cents, features, limits, position",
      )
      .eq("visible", true)
      .order("position");

    if (error || !data) return [];
    const rows = data as PlanRow[];

    // A posição é por público, não global: o `highlighted` de "proprietários"
    // não deve depender de quantos planos de comprador existem.
    const byAudience = new Map<string, PlanRow[]>();
    for (const row of rows) {
      const key = row.audience === "owner" || row.audience === "buyer" ? row.audience : "both";
      byAudience.set(key, [...(byAudience.get(key) ?? []), row]);
    }

    return [...byAudience.values()].flatMap((group) =>
      group.map((row, index) => toPublicPlan(row, index, group.length)),
    );
  },
  ["public-plans"],
  { tags: [PLANS_TAG], revalidate: 300 },
);

/** Catálogo vazio não é erro: a página de preços diz que está a ser preparado. */
export async function getPublicPlans(): Promise<PublicPlan[]> {
  try {
    return await read();
  } catch {
    return [];
  }
}
