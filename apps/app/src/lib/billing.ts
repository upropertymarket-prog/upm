import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@upm/db";
import {
  LIMIT_KEYS,
  limitsSchema,
  type BillingInterval,
  type LimitKey,
  type PlanLimits,
  type SubscriptionStatus,
} from "@upm/db/billing";

/**
 * Leituras do ecrã `/plano` (P7-02)
 * =========================================================================
 * O estado vem de `plan_status()`, uma função `security definer` — mesmo
 * padrão de `cloud_status()` na Fase 6. Os limites que ela devolve já são os
 * **efetivos** (plano + extras, 07 §19.3); nenhum ecrã lê `plans.limits`.
 *
 * Os preços vêm sempre de `plans`/`addons`. Não há um número de euros escrito
 * em código nesta funcionalidade — a grelha de 07 §8.3 é provisória e a
 * questão 07 §9 #2 continua aberta.
 */

type Client = SupabaseClient<Database>;

export type PlanStatus = {
  planId: string | null;
  planSlug: string | null;
  planName: string | null;
  planAudience: "owner" | "buyer" | "both" | null;
  subscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  interval: BillingInterval | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  hasCloudAddon: boolean;
  limits: PlanLimits;
  usage: Record<LimitKey, number>;
  cloudUsedBytes: number;
  cloudLimitBytes: number | null;
};

export type PlanOption = {
  id: string;
  slug: string;
  name: string;
  audience: "owner" | "buyer" | "both";
  priceMonthCents: number;
  priceYearCents: number;
  features: string[];
  limits: PlanLimits;
  /** `false` quando o plano ainda não foi sincronizado com o Stripe (P7-01). */
  purchasable: boolean;
};

export type AddonOption = {
  id: string;
  slug: string;
  name: string;
  priceMonthCents: number;
  priceYearCents: number;
  grants: PlanLimits;
  purchasable: boolean;
};

export type InvoiceRow = {
  id: string;
  number: string | null;
  totalCents: number;
  status: string;
  issuedAt: string | null;
  hasPdf: boolean;
  savedToCloud: boolean;
};

const EMPTY_USAGE = Object.fromEntries(LIMIT_KEYS.map((key) => [key, 0])) as Record<
  LimitKey,
  number
>;

function parseLimits(value: unknown): PlanLimits {
  const parsed = limitsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export async function loadPlanStatus(supabase: Client): Promise<PlanStatus> {
  const { data } = await supabase.rpc("plan_status");
  const row = data?.[0];

  const usage = { ...EMPTY_USAGE };
  const rawUsage = (row?.usage ?? {}) as Record<string, unknown>;
  for (const key of LIMIT_KEYS) {
    const value = rawUsage[key];
    if (typeof value === "number") usage[key] = value;
  }

  return {
    planId: row?.plan_id ?? null,
    planSlug: row?.plan_slug ?? null,
    planName: row?.plan_name ?? null,
    planAudience: row?.plan_audience ?? null,
    subscriptionId: row?.subscription_id ?? null,
    subscriptionStatus: (row?.subscription_status as SubscriptionStatus | null) ?? null,
    interval: (row?.billing_interval as BillingInterval | null) ?? null,
    currentPeriodEnd: row?.current_period_end ?? null,
    cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
    trialEndsAt: row?.trial_ends_at ?? null,
    hasCloudAddon: row?.has_cloud_addon ?? false,
    limits: parseLimits(row?.limits),
    usage,
    cloudUsedBytes: Number(row?.cloud_used_bytes ?? 0),
    cloudLimitBytes:
      row?.cloud_limit_bytes === null || row?.cloud_limit_bytes === undefined
        ? null
        : Number(row.cloud_limit_bytes),
  };
}

/**
 * Os planos que ESTE perfil pode comprar. Um proprietário não vê os planos de
 * comprador e vice-versa (05 §6.6, `plans.audience`); `both` serve os dois e é
 * o caso do Gratuito.
 */
export async function loadPlanOptions(
  supabase: Client,
  role: "owner" | "buyer",
): Promise<PlanOption[]> {
  const { data } = await supabase
    .from("plans")
    .select(
      "id, slug, name, audience, price_month_cents, price_year_cents, features, limits, stripe_price_month_id, stripe_price_year_id",
    )
    .eq("visible", true)
    .in("audience", [role, "both"])
    .order("position");

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    audience: row.audience,
    priceMonthCents: Number(row.price_month_cents),
    priceYearCents: Number(row.price_year_cents),
    features: row.features ?? [],
    limits: parseLimits(row.limits),
    purchasable: Boolean(row.stripe_price_month_id && row.stripe_price_year_id),
  }));
}

/** 07 §19.3 — hoje só existe um: Cloud 5 GB. */
export async function loadAddonOptions(supabase: Client): Promise<AddonOption[]> {
  const { data } = await supabase
    .from("addons")
    .select(
      "id, slug, name, price_month_cents, price_year_cents, grants, stripe_price_month_id, stripe_price_year_id",
    )
    .eq("visible", true)
    .order("position");

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    priceMonthCents: Number(row.price_month_cents),
    priceYearCents: Number(row.price_year_cents),
    grants: parseLimits(row.grants),
    purchasable: Boolean(row.stripe_price_month_id && row.stripe_price_year_id),
  }));
}

export async function loadInvoices(supabase: Client, limit = 24): Promise<InvoiceRow[]> {
  const { data } = await supabase
    .from("invoices")
    .select("id, number, total_cents, status, issued_at, pdf_url, saved_file_id")
    .order("issued_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id,
    number: row.number,
    totalCents: Number(row.total_cents),
    status: row.status,
    issuedAt: row.issued_at,
    // O URL em si nunca vai para o cliente: quem o resolve é a server action
    // de P7-04, que o lê do Stripe. Aqui só interessa se há PDF para pedir.
    hasPdf: Boolean(row.pdf_url),
    savedToCloud: Boolean(row.saved_file_id),
  }));
}
