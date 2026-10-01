"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import { planFormSchema, syncCatalog } from "@upm/db/billing";
import { createCatalogStore, createServiceClient, createStripeCatalogApi } from "@upm/db/stripe";

/**
 * Admin › Planos — Server Actions (P7-05)
 * =========================================================================
 * Guardar um plano é a única escrita de preço de todo o produto. Duas regras:
 *
 * 1. **Só admin**, verificado no servidor. A policy `plans_admin_write` já o
 *    impõe na base de dados; isto é a segunda fechadura, e é a que dá uma
 *    mensagem em vez de um erro de RLS.
 * 2. **Nunca se edita um `Price` do Stripe** (02 §9). Guardar um preço
 *    diferente dispara a sincronização de P7-01, que cria um `Price` novo e
 *    deixa o antigo a servir quem já o subscreveu.
 */

export type PlanActionState = { ok?: boolean; error?: string; notice?: string };

async function admin() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, isAdmin: profile?.role === "admin" };
}

/** Lê o formulário. Um limite vazio é ILIMITADO — `null`, nunca um número grande. */
function limitFrom(formData: FormData, key: string): number | null {
  const raw = (formData.get(`limit_${key}`) as string | null)?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function centsFrom(formData: FormData, key: string): number {
  const raw = (formData.get(key) as string | null)?.trim().replace(",", ".") ?? "0";
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : 0;
}

export async function savePlan(
  _prev: PlanActionState,
  formData: FormData,
): Promise<PlanActionState> {
  const { supabase, user, isAdmin } = await admin();
  if (!user || !isAdmin) return { error: "Sem permissão." };

  const parsed = planFormSchema.safeParse({
    id: (formData.get("id") as string | null) || undefined,
    slug: formData.get("slug"),
    name: formData.get("name"),
    audience: formData.get("audience"),
    priceMonthCents: centsFrom(formData, "priceMonth"),
    priceYearCents: centsFrom(formData, "priceYear"),
    features: ((formData.get("features") as string | null) ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    limits: {
      active_properties: limitFrom(formData, "active_properties"),
      visits: limitFrom(formData, "visits"),
      active_chats: limitFrom(formData, "active_chats"),
      saved: limitFrom(formData, "saved"),
      alerts: limitFrom(formData, "alerts"),
      cloud_gb: limitFrom(formData, "cloud_gb"),
    },
    visible: formData.get("visible") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const plan = parsed.data;
  const row = {
    slug: plan.slug,
    name: plan.name,
    audience: plan.audience,
    price_month_cents: plan.priceMonthCents,
    price_year_cents: plan.priceYearCents,
    features: plan.features,
    limits: plan.limits,
    visible: plan.visible,
  };

  const before = plan.id
    ? (
        await supabase
          .from("plans")
          .select("price_month_cents, price_year_cents, limits")
          .eq("id", plan.id)
          .maybeSingle()
      ).data
    : null;

  const saved = plan.id
    ? await supabase.from("plans").update(row).eq("id", plan.id).select("id").single()
    : await supabase.from("plans").insert(row).select("id").single();

  if (saved.error) {
    return {
      error:
        saved.error.code === "23505"
          ? "Já existe um plano com esse slug."
          : "Não foi possível guardar o plano.",
    };
  }

  // 08 §6.7: alteração de plano ou preço fica no registo.
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: plan.id ? "plan.updated" : "plan.created",
    entity: "plans",
    entity_id: saved.data.id,
    diff: { before, after: row },
  });

  revalidatePath("/admin/planos");

  const priceChanged =
    !before ||
    Number(before.price_month_cents) !== plan.priceMonthCents ||
    Number(before.price_year_cents) !== plan.priceYearCents;

  if (!priceChanged || plan.priceMonthCents + plan.priceYearCents === 0) {
    return { ok: true };
  }

  const sync = await syncStripe();
  return sync.error ? { ok: true, notice: sync.error } : { ok: true, notice: sync.notice };
}

/**
 * Corre a sincronização de P7-01. Sem `STRIPE_SECRET_KEY` configurada, o plano
 * fica guardado na mesma e a página diz que o Stripe não foi atualizado — é
 * preferível a perder a alteração por causa de uma credencial em falta.
 */
export async function syncStripe(): Promise<{ notice?: string; error?: string }> {
  const { user, isAdmin } = await admin();
  if (!user || !isAdmin) return { error: "Sem permissão." };

  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: "Guardado. O Stripe não foi atualizado: falta STRIPE_SECRET_KEY." };
  }

  try {
    const report = await syncCatalog(
      createStripeCatalogApi(),
      createCatalogStore(createServiceClient()),
    );
    revalidatePath("/admin/planos");
    return {
      notice:
        `Stripe sincronizado: ${report.created} criados, ` +
        `${report.pricesAdded} com preço novo, ${report.unchanged} sem alterações.`,
    };
  } catch {
    return { error: "Guardado. A sincronização com o Stripe falhou — tente outra vez." };
  }
}
