import { cookies } from "next/headers";
import { createClient } from "@upm/db/server";
import { limitsSchema, type PlanLimits } from "@upm/db/billing";

import { InternalChrome } from "../../../components/InternalChrome";
import { setLocalePreference } from "../../actions/preferences";
import {
  PlansManager,
  type AdminInvoiceRow,
  type PlanRow,
  type TrialRequestRow,
} from "./PlansManager";
import { decideTrialExtension, savePlan, syncStripe } from "./actions";
import { verifyOperationPin } from "../../actions/step-up";
import { getAdminShellData } from "../../../lib/admin-shell";

export const dynamic = "force-dynamic";

/**
 * Admin › Planos — `/admin/planos` (P7-05 · 04 §8.5)
 * =========================================================================
 * Três leituras agregadas em SQL (08 §4.5/§4.7): métricas por plano, resumo
 * da receita e faturação recente. A página não conta nada por si; se contasse,
 * uma plataforma com dez mil subscrições faria dez mil queries.
 */
export default async function PlansPage() {
  const supabase = createClient(await cookies());

  const [shell, metrics, summary, invoices, trials, catalog] = await Promise.all([
    getAdminShellData(supabase),
    supabase.rpc("admin_plan_metrics"),
    supabase.rpc("admin_billing_summary"),
    supabase.rpc("admin_recent_invoices", { p_limit: 20 }),
    supabase.rpc("admin_trial_requests"),
    supabase
      .from("plans")
      .select(
        "id, features, limits, stripe_price_month_id, stripe_price_year_id, intro_price_month_cents, intro_price_year_cents",
      ),
  ]);

  const extras = new Map(
    (catalog.data ?? []).map((row) => [
      row.id,
      {
        features: row.features ?? [],
        limits: (limitsSchema.safeParse(row.limits ?? {}).data ?? {}) as PlanLimits,
        synced: Boolean(row.stripe_price_month_id && row.stripe_price_year_id),
        introMonthCents:
          row.intro_price_month_cents === null ? null : Number(row.intro_price_month_cents),
        introYearCents:
          row.intro_price_year_cents === null ? null : Number(row.intro_price_year_cents),
      },
    ]),
  );

  const plans: PlanRow[] = (metrics.data ?? []).map((row) => {
    const extra = extras.get(row.plan_id);
    return {
      planId: row.plan_id,
      slug: row.slug,
      name: row.name,
      audience: row.audience,
      priceMonthCents: Number(row.price_month_cents),
      priceYearCents: Number(row.price_year_cents),
      visible: row.visible,
      subscribers: Number(row.subscribers),
      mrrCents: Number(row.mrr_cents),
      features: extra?.features ?? [],
      limits: extra?.limits ?? {},
      introMonthCents: extra?.introMonthCents ?? null,
      introYearCents: extra?.introYearCents ?? null,
      // Um plano gratuito não vai ao Stripe e isso não é falta nenhuma.
      syncedWithStripe:
        (extra?.synced ?? false) ||
        (Number(row.price_month_cents) === 0 && Number(row.price_year_cents) === 0),
    };
  });

  const totals = summary.data?.[0];

  const trialRequests: TrialRequestRow[] = (trials.data ?? []).map((row) => ({
    id: row.id,
    clientName: row.client_name,
    reason: row.reason,
    status: row.status as TrialRequestRow["status"],
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
  }));

  const recent: AdminInvoiceRow[] = (invoices.data ?? []).map((row) => ({
    id: row.id,
    number: row.number,
    totalCents: Number(row.total_cents),
    status: row.status,
    issuedAt: row.issued_at,
    clientName: row.client_name,
    planName: row.plan_name,
  }));

  return (
    <InternalChrome
      role="admin"
      userName={shell.userName}
      userMeta={shell.userMeta}
      activeId="plans"
      locale={shell.locale}
      onLocaleChange={setLocalePreference}
      counters={shell.counters}
    >
      <PlansManager
        plans={plans}
        summary={{
          mrrCents: Number(totals?.mrr_cents ?? 0),
          subscribers: Number(totals?.subscribers ?? 0),
          trials: Number(totals?.trials ?? 0),
          pastDue: Number(totals?.past_due ?? 0),
          canceled30d: Number(totals?.canceled_30d ?? 0),
          new30d: Number(totals?.new_30d ?? 0),
          addonSubscribers: Number(totals?.addon_subscribers ?? 0),
        }}
        invoices={recent}
        trialRequests={trialRequests}
        onSave={savePlan}
        onSync={syncStripe}
        onDecideTrial={decideTrialExtension}
        onVerifyPin={verifyOperationPin}
      />
    </InternalChrome>
  );
}
