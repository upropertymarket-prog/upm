"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import { planFormSchema, syncCatalog } from "@upm/db/billing";
import { isStepUpRequiredError } from "@upm/db/auth";
import { writeAuditLog } from "@upm/db/audit";
import {
  createCatalogStore,
  createServiceClient,
  createStripeCatalogApi,
  getStripeClient,
} from "@upm/db/stripe";

/**
 * Admin › Planos — Server Actions (P7-05)
 * =========================================================================
 * Guardar um plano é a única escrita de preço de todo o produto. Três regras:
 *
 * 1. **Só admin**, verificado no servidor. A policy `plans_admin_write` já o
 *    impõe na base de dados; isto é a segunda fechadura, e é a que dá uma
 *    mensagem em vez de um erro de RLS.
 * 2. **Nunca se edita um `Price` do Stripe** (02 §9). Guardar um preço
 *    diferente dispara a sincronização de P7-01, que cria um `Price` novo e
 *    deixa o antigo a servir quem já o subscreveu.
 * 3. **Exige step-up de PIN** (07 §6), desde P8-07. O guarda está no gatilho
 *    `plans_require_step_up`, não aqui: a policy deixa qualquer sessão de admin
 *    escrever em `plans` pelo PostgREST, e uma verificação nesta função não
 *    cobria esse caminho (07 §20.5). Aqui só se traduz a recusa.
 */

export type PlanActionState = {
  ok?: boolean;
  error?: string;
  notice?: string;
  /** O servidor recusou por falta de PIN confirmado — a UI abre o modal. */
  needsStepUp?: boolean;
  /**
   * D40 — baixar um limite abaixo do que subscritores já usam. Nada foi
   * gravado: a UI mostra este aviso e pede confirmação, que volta no campo
   * `confirmOverage`.
   */
  overageWarning?: string;
};

/** Rótulos dos limites para o aviso de D40 — PT, como o resto do interno. */
const LIMIT_WARNING_LABELS: Record<string, string> = {
  active_properties: "propriedades ativas",
  visits: "pedidos de visita por mês",
  active_chats: "conversas ativas",
  saved: "propriedades guardadas",
  alerts: "alertas de pesquisa",
};

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

  // D40 — antes de gravar: há subscritores a usar mais do que o limite novo?
  // Só faz sentido num plano que já existe, e só até à confirmação. O cast sai
  // com o próximo `pnpm db:types` (função nova em `20261006120200`).
  if (plan.id && formData.get("confirmOverage") !== "on") {
    const overageRpc = supabase.rpc as unknown as (
      fn: "plan_limit_overage",
      args: { p_plan_id: string; p_limits: typeof plan.limits },
    ) => Promise<{
      data: { limit_key: string; affected: number; max_used: number }[] | null;
      error: unknown;
    }>;
    const { data: overage } = await overageRpc("plan_limit_overage", {
      p_plan_id: plan.id,
      p_limits: plan.limits,
    });

    if (overage && overage.length > 0) {
      const lines = overage.map((entry) => {
        const label = LIMIT_WARNING_LABELS[entry.limit_key] ?? entry.limit_key;
        const accounts = entry.affected === 1 ? "1 conta" : `${entry.affected} contas`;
        return `${accounts} acima do limite de ${label} (máximo em uso: ${entry.max_used})`;
      });
      return {
        overageWarning:
          `Este limite fica abaixo do que já está em uso: ${lines.join("; ")}. ` +
          "Ao guardar, essas contas ficam em excedente até à renovação — continuam " +
          "a ver e a usar o que têm, e nada é apagado (02 §5). Nada foi gravado ainda.",
      };
    }
  }

  const saved = plan.id
    ? await supabase.from("plans").update(row).eq("id", plan.id).select("id").single()
    : await supabase.from("plans").insert(row).select("id").single();

  if (saved.error) {
    if (isStepUpRequiredError(saved.error)) return { needsStepUp: true };
    return {
      error:
        saved.error.code === "23505"
          ? "Já existe um plano com esse slug."
          : "Não foi possível guardar o plano.",
    };
  }

  // 08 §6.7: alteração de plano ou preço fica no registo.
  //
  // Passa por `write_audit_log` desde P8-07. A versão anterior inseria em
  // `audit_log` com a sessão do utilizador, e a tabela não tem policy de insert
  // de propósito — a RLS recusava, o erro era ignorado, e nenhuma alteração de
  // preço desta fase deixou rasto. Ver 07 §21.7.
  // O plano já está escrito, por isso uma falha aqui não desfaz nada — mas
  // também não se cala: quem lê o registo tem de saber que ele está incompleto.
  let auditWarning: string | undefined;
  try {
    await writeAuditLog(supabase, {
      action: plan.id ? "plan.updated" : "plan.created",
      entity: "plans",
      entityId: saved.data.id,
      diff: { before, after: row },
    });
  } catch {
    auditWarning = "Guardado, mas o registo de auditoria falhou — avise a administração.";
  }

  revalidatePath("/admin/planos");

  const priceChanged =
    !before ||
    Number(before.price_month_cents) !== plan.priceMonthCents ||
    Number(before.price_year_cents) !== plan.priceYearCents;

  if (!priceChanged || plan.priceMonthCents + plan.priceYearCents === 0) {
    return { ok: true, notice: auditWarning };
  }

  const sync = await syncStripe();
  const notice = [auditWarning, sync.error ?? sync.notice].filter(Boolean).join(" ");
  return { ok: true, notice: notice || undefined };
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

// ---------------------------------------------------------------------------
// Pedidos de trial — P7-06 (07 §8.1)
// ---------------------------------------------------------------------------

/**
 * Aprovar soma 7 dias; recusar deixa a data original. A decisão, a
 * notificação e o `audit_log` acontecem na mesma transação, em SQL
 * (`decide_trial_extension`).
 *
 * Aprovar tem um segundo passo: o Stripe também tem de saber, senão a conta
 * fica com mais sete dias na nossa base de dados e a cobrança a cair na data
 * antiga. Se o Stripe falhar, a resposta di-lo em vez de fingir que correu.
 */
export async function decideTrialExtension(
  requestId: string,
  approve: boolean,
): Promise<PlanActionState> {
  const { supabase, user, isAdmin } = await admin();
  if (!user || !isAdmin) return { error: "Sem permissão." };

  const { data: subscriptionId } = await supabase
    .from("trial_extension_requests")
    .select("subscription_id")
    .eq("id", requestId)
    .maybeSingle();

  const { data: newEnd, error } = await supabase.rpc("decide_trial_extension", {
    p_id: requestId,
    p_approve: approve,
  });
  if (error) return { error: error.message ?? "Não foi possível decidir o pedido." };

  revalidatePath("/admin/planos");

  if (!approve || !newEnd || !subscriptionId?.subscription_id) return { ok: true };

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("id", subscriptionId.subscription_id)
    .maybeSingle();

  if (!subscription?.stripe_subscription_id || !process.env.STRIPE_SECRET_KEY) {
    return { ok: true, notice: "Aprovado. O Stripe não foi atualizado — confirme a subscrição." };
  }

  try {
    const stripe = getStripeClient();
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      trial_end: Math.floor(new Date(newEnd).getTime() / 1000),
      proration_behavior: "none",
    });
    return { ok: true, notice: "Aprovado — mais 7 dias, no Stripe e aqui." };
  } catch {
    return {
      ok: true,
      notice: "Aprovado aqui, mas o Stripe recusou a nova data. Verifique a subscrição.",
    };
  }
}
