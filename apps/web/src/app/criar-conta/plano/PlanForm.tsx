"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@upm/ui";

import { selectPlan, type SelectPlanState } from "../actions";

type Plan = {
  id: string;
  slug: string;
  name: string;
  price_month_cents: number | null;
  price_year_cents: number | null;
};

const initialState: SelectPlanState = {};

export function PlanForm({ plans }: { plans: Plan[] }) {
  const t = useTranslations("auth.register.plan");
  const [selected, setSelected] = useState<string | null>(
    plans.find((plan) => plan.slug === "gratuito")?.id ?? plans[0]?.id ?? null,
  );
  const [state, formAction, pending] = useActionState(selectPlan, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="planId" value={selected ?? ""} />
      <div className="flex flex-col gap-2">
        {plans.map((plan) => (
          <label
            key={plan.id}
            className="flex cursor-pointer items-center justify-between rounded-xl border border-border p-4 has-checked:border-accent has-checked:bg-accent-soft"
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="planRadio"
                value={plan.id}
                checked={selected === plan.id}
                onChange={() => setSelected(plan.id)}
              />
              <strong className="text-text">{plan.name}</strong>
            </span>
            <span className="text-sm text-muted">
              {plan.price_month_cents
                ? `${(plan.price_month_cents / 100).toFixed(2)} €${t("perMonth")}`
                : t("free")}
            </span>
          </label>
        ))}
      </div>
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !selected} fullWidth>
        {t("submit")}
      </Button>
    </form>
  );
}
