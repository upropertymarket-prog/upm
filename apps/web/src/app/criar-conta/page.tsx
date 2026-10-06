import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { currentLegalDocument, isPendingLegalReview } from "@upm/db/legal";
import { pendingSelectMany, pendingSelectOne } from "@upm/db/pending-types";
import { resolveCommitmentMonths } from "@upm/db/subscription";

import { AuthShell } from "../../components/auth/AuthLayout";
import { RegisterWizard, type RegisterPlan } from "./RegisterWizard";
import { registerAccount } from "./actions";

export const metadata: Metadata = {
  title: "Criar conta · UProperty Market",
};

export const dynamic = "force-dynamic";

/** A forma das linhas de `plans` que esta página precisa, com a coluna nova. */
type PlanRow = {
  slug: string;
  name: string;
  audience: "owner" | "buyer" | "both";
  price_month_cents: number;
  price_year_cents: number;
  features: string[] | null;
  default_commitment_months: number | null;
};

/**
 * Criar conta — `/criar-conta` (Fase 9: P9-01, P9-02, P9-05, P9-09)
 * =========================================================================
 * A página carrega as três coisas que a contratação precisa de mostrar **antes
 * de cobrar**: a escada de planos (já sem degrau gratuito — P9-05), o período
 * mínimo que se vai aplicar, e a versão publicada dos Termos com o seu hash.
 *
 * O período mínimo não é decoração: o DL 24/2014 (art. 4.º) obriga a informar a
 * duração do contrato e os requisitos de cessação antes da celebração, e a
 * omissão alarga o prazo de livre resolução. Por isso é lido da configuração —
 * `plans.default_commitment_months` e, em falta, o global de `app_settings` — e
 * nunca escrito aqui.
 *
 * O hash dos Termos viaja até ao formulário e volta na submissão. Se o texto
 * mudar entre o ecrã abrir e o botão ser premido, a ação recusa: fica registado
 * o documento que a pessoa viu, nunca um que entrou pelo meio.
 */
export default async function RegisterPage() {
  const supabase = createClient(await cookies());
  const [locale, ts] = await Promise.all([getLocale(), getTranslations("auth.shell")]);

  const [plans, globalCommitment, terms] = await Promise.all([
    // `pendingSelectMany` porque `default_commitment_months` só entra nos tipos
    // gerados depois de `pnpm db:types` (D52).
    pendingSelectMany<PlanRow>(
      supabase,
      "plans",
      "slug, name, audience, price_month_cents, price_year_cents, features, default_commitment_months",
      { filters: { visible: true }, orderBy: "position" },
    ),
    pendingSelectOne<{ value: number | null }>(supabase, "app_settings", "value", {
      key: "subscription_default_commitment_months",
    }),
    currentLegalDocument(supabase, "terms", locale),
  ]);

  const globalMonths = globalCommitment.data?.value ?? null;

  const registerPlans: RegisterPlan[] = (plans.data ?? []).map((plan) => ({
    slug: plan.slug,
    name: plan.name,
    audience: plan.audience,
    priceMonthCents: plan.price_month_cents,
    priceYearCents: plan.price_year_cents,
    features: plan.features ?? [],
    commitmentMonths: resolveCommitmentMonths(plan.default_commitment_months, globalMonths),
  }));

  return (
    <AuthShell
      width="lg"
      switchPrompt={ts("haveAccount")}
      switchHref="/entrar"
      switchLabel={ts("signIn")}
      legalLabel={ts("legal")}
    >
      <RegisterWizard
        action={registerAccount}
        plans={registerPlans}
        terms={
          terms
            ? {
                documentId: terms.id,
                version: terms.version,
                contentHash: terms.contentHash,
                pendingLegalReview: isPendingLegalReview(terms),
              }
            : null
        }
      />
    </AuthShell>
  );
}
