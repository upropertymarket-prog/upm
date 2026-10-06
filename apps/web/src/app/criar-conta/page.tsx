import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { currentLegalDocument, isPendingLegalReview } from "@upm/db/legal";

import { AuthPage } from "../../components/auth/AuthLayout";
import { RegisterWizard, type RegisterPlan } from "./RegisterWizard";
import { registerAccount } from "./actions";

export const metadata: Metadata = {
  title: "Criar conta · UProperty Market",
};

export const dynamic = "force-dynamic";

/**
 * Criar conta — `/criar-conta` (Fase 9: P9-01, P9-02, P9-05, P9-09)
 * =========================================================================
 * A página carrega as duas coisas que a contratação precisa de mostrar antes de
 * cobrar: a escada de planos (já sem degrau gratuito — P9-05) e a versão
 * publicada dos Termos, com o seu hash.
 *
 * O hash viaja até ao formulário e volta na submissão. Se o texto mudar entre o
 * ecrã abrir e o botão ser premido, a ação recusa: fica registado o documento
 * que a pessoa viu, nunca um que entrou pelo meio.
 */
export default async function RegisterPage() {
  const supabase = createClient(await cookies());
  const locale = await getLocale();

  const [{ data: plans }, terms] = await Promise.all([
    supabase
      .from("plans")
      .select("slug, name, audience, price_month_cents, price_year_cents, features")
      .eq("visible", true)
      .order("position"),
    currentLegalDocument(supabase, "terms", locale),
  ]);

  const registerPlans: RegisterPlan[] = (plans ?? []).map((plan) => ({
    slug: plan.slug,
    name: plan.name,
    audience: plan.audience,
    priceMonthCents: plan.price_month_cents,
    priceYearCents: plan.price_year_cents,
    features: plan.features ?? [],
  }));

  return (
    <AuthPage>
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
    </AuthPage>
  );
}
