import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@upm/db/server";

import { AppChrome } from "../../components/AppChrome";
import { PlanScreen } from "../../components/billing/PlanScreen";
import { canCancelSubscription, resolveCommitmentMonths } from "@upm/db/subscription";

import {
  loadAddonOptions,
  loadCurrentTerms,
  loadInvoices,
  loadPlanOptions,
  loadPlanStatus,
} from "../../lib/billing";
import {
  countersFor,
  loadConversations,
  loadLeads,
  loadNotifications,
  loadVisits,
} from "../../lib/interaction";
import {
  cancelSubscription,
  exportInvoice,
  openBillingPortal,
  saveInvoiceToCloud,
  startCheckout,
} from "../actions/billing";
import { setLocalePreference } from "../actions/preferences";

export const dynamic = "force-dynamic";

/**
 * Plano — `/plano` (P7-02 · 03 F8)
 * =========================================================================
 * Os dois papéis têm esta página (07 §4.2 e §4.3). O que muda é a grelha de
 * planos: `plans.audience` já separa proprietário de comprador.
 *
 * Três parâmetros chegam de fora e é de propósito:
 *  - `?plano=<slug>` — quem escolheu um plano pago no registo (03 F2).
 *  - `?extra=cloud`  — o convite de 07 §19.4 emitido pelo ecrã `/cloud`.
 *  - `?checkout=`    — o regresso do Stripe Checkout.
 */
export default async function PlanoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = createClient(await cookies());
  const [locale, { data: authData }, params] = await Promise.all([
    getLocale(),
    supabase.auth.getUser(),
    searchParams,
  ]);

  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "owner" && profile.role !== "buyer")) redirect("/");

  const role = profile.role;

  const [status, plans, addons, invoices, terms, conversations, visits, leads, notifications] =
    await Promise.all([
      loadPlanStatus(supabase),
      loadPlanOptions(supabase, role),
      loadAddonOptions(supabase),
      loadInvoices(supabase),
      loadCurrentTerms(supabase, locale),
      loadConversations(supabase),
      loadVisits(supabase),
      role === "owner" ? loadLeads(supabase) : Promise.resolve([]),
      loadNotifications(supabase, locale),
    ]);

  // P9-04 — a decisão vem da porta única, lida aqui e passada ao ecrã. O
  // componente não a recalcula e não conhece a regra.
  const cancelDecision = status.subscriptionId
    ? await canCancelSubscription(supabase, status.subscriptionId)
    : null;

  // P9-03 — o período mínimo que se aplica a quem subscrever agora (12 meses
  // desde 7 out 2026). Vem da configuração, nunca de código.
  const { data: globalCommitment } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "subscription_default_commitment_months")
    .maybeSingle();

  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

  const checkout = one(params.checkout);

  return (
    <AppChrome
      role={role}
      userName={profile.full_name || (role === "owner" ? "Proprietário" : "Comprador")}
      userMeta={role === "owner" ? "Proprietário" : "Comprador"}
      activeId="plan"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={countersFor(role, conversations, visits, leads)}
      notifications={notifications}
    >
      <PlanScreen
        status={status}
        plans={plans}
        addons={addons}
        invoices={invoices}
        highlightPlanSlug={one(params.plano)}
        highlightAddon={one(params.extra) === "cloud"}
        checkoutResult={checkout === "sucesso" || checkout === "cancelado" ? checkout : undefined}
        onCheckout={startCheckout}
        onOpenPortal={openBillingPortal}
        onExportInvoice={exportInvoice}
        onSaveInvoice={saveInvoiceToCloud}
        terms={terms}
        termsHref={`${process.env.WEB_URL ?? "http://localhost:4300"}/termos`}
        defaultCommitmentMonths={resolveCommitmentMonths(null, globalCommitment?.value ?? null)}
        cancelDecision={cancelDecision}
        onCancelSubscription={cancelSubscription}
      />
    </AppChrome>
  );
}
