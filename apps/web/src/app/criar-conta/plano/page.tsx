import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";
import { getTranslations } from "next-intl/server";

import { AuthCard, AuthPage, AuthTitle } from "../../../components/auth/AuthLayout";
import { PlanForm } from "./PlanForm";
import { selectPlan } from "../actions";

export default async function ChoosePlanPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const { data: plans } = await supabase
    .from("plans")
    .select("id, slug, name, audience, price_month_cents, price_year_cents")
    .eq("visible", true)
    .in("audience", profile?.role === "owner" ? ["owner", "both"] : ["buyer", "both"])
    .order("position");

  const t = await getTranslations("auth.register.plan");

  return (
    <AuthPage>
      <AuthCard width="lg">
        <AuthTitle>{t("title")}</AuthTitle>
        <p className="text-sm text-muted">{t("hint")}</p>
        <PlanForm plans={plans ?? []} action={selectPlan} />
      </AuthCard>
    </AuthPage>
  );
}
