/**
 * Um plano a sério para as contas de teste — só para os testes contra a base
 * =========================================================================
 * Desde P9-05 (7 out 2026) não há plano gratuito: sem subscrição ativa,
 * `effective_limits()` devolve `no_plan_limits()`, e guardar, criar alertas,
 * abrir conversas ou pedir visitas é recusado pelos triggers de
 * `enforce_plan_limit` ("Chegou ao limite do seu plano."). É o comportamento
 * certo para um cliente — e foi o que deixou 37 testes do `rls-matrix` a cair
 * em cascata quando a suite correu pela primeira vez contra a base real, a
 * 1 nov: as contas de teste nunca tinham pago nada.
 *
 * A saída **não** é afrouxar a regra (um "modo de teste" no trigger seria uma
 * porta aberta em produção). É dar à conta de teste o que o webhook do Stripe
 * dá a quem paga: uma linha `active` em `subscriptions`. Os planos `premium-*`
 * têm os tetos a `null` (ilimitado), para que correr a suite dez vezes não
 * esbarre no limite — os limites em si são testados à parte, em
 * `billing-rls.test.ts`, com planos de teto baixo.
 *
 * Só se usa com o cliente `service_role`, que é quem escreve em
 * `subscriptions` (12 §7.1). As contas `*.test` são apagadas no `afterAll` de
 * cada ficheiro e a subscrição sai com elas, em cascata.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type TestPlanSlug = "premium-buyer" | "premium-owner";

/** Garante uma subscrição `active` ao plano pedido. Idempotente. */
export async function grantTestPlan(
  service: SupabaseClient,
  profileId: string,
  slug: TestPlanSlug,
): Promise<void> {
  const { data: plan, error: planError } = await service
    .from("plans")
    .select("id")
    .eq("slug", slug)
    .single();
  if (planError || !plan) {
    throw new Error(`Plano de teste em falta: ${slug} (${planError?.message ?? "sem linha"})`);
  }

  const { data: existing } = await service
    .from("subscriptions")
    .select("id")
    .eq("profile_id", profileId)
    .eq("plan_id", plan.id)
    .eq("status", "active")
    .limit(1);
  if (existing && existing.length > 0) return;

  const { error } = await service
    .from("subscriptions")
    .insert({ profile_id: profileId, plan_id: plan.id, status: "active" });
  if (error) throw new Error(`Falha a dar o plano ${slug} a ${profileId}: ${error.message}`);
}
