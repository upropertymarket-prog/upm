import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";
import { getTranslations } from "next-intl/server";

import { PlanForm } from "./PlanForm";

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
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <h1 className="text-lg font-semibold text-text">{t("title")}</h1>
        <p className="text-sm text-muted">{t("hint")}</p>
        <PlanForm plans={plans ?? []} />
      </div>
    </main>
  );
}
