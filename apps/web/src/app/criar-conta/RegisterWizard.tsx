"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, Input } from "@upm/ui";

type Step = "profile" | "account";
type ProfileChoice = "buyer" | "owner";

/**
 * Definido aqui, não em `./actions`: `actions.ts` importa `next/headers`
 * (server-only) e importá-lo — mesmo só o tipo — parte a compilação do
 * canvas para o projeto inteiro. `./actions` importa este tipo daqui.
 */
export type RegisterState = {
  error?: string;
  fieldErrors?: Partial<Record<"fullName" | "email" | "password", string>>;
};

const initialState: RegisterState = {};

export type RegisterWizardProps = {
  /**
   * Injetada pela página (`action={registerAccount}`), nunca importada aqui:
   * puxa `next/headers` (server-only), e importá-lo neste componente parte a
   * compilação do canvas para o projeto inteiro. O canvas passa uma ação de
   * demonstração em vez da real.
   */
  action: (state: RegisterState, formData: FormData) => Promise<RegisterState>;
};

export function RegisterWizard({ action }: RegisterWizardProps) {
  const t = useTranslations("auth");
  const [step, setStep] = useState<Step>("profile");
  const [role, setRole] = useState<ProfileChoice | null>(null);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Card padded className="mx-auto flex w-full max-w-md flex-col gap-5">
      <ol className="flex gap-4 text-sm text-muted" aria-label={t("register.title")}>
        <li
          aria-current={step === "profile" ? "step" : undefined}
          className="aria-[current]:text-accent aria-[current]:font-semibold"
        >
          {t("register.steps.profile")}
        </li>
        <li
          aria-current={step === "account" ? "step" : undefined}
          className="aria-[current]:text-accent aria-[current]:font-semibold"
        >
          {t("register.steps.account")}
        </li>
      </ol>

      {step === "profile" ? (
        <div className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-text">{t("register.profile.title")}</h1>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="flex flex-col gap-1 rounded-xl border border-border p-4 text-left hover:border-accent data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft"
              data-selected={role === "buyer" ? "true" : undefined}
              onClick={() => setRole("buyer")}
            >
              <strong className="text-text">{t("register.profile.buyer")}</strong>
              <span className="text-sm text-muted">{t("register.profile.buyerHint")}</span>
            </button>
            <button
              type="button"
              className="flex flex-col gap-1 rounded-xl border border-border p-4 text-left hover:border-accent data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft"
              data-selected={role === "owner" ? "true" : undefined}
              onClick={() => setRole("owner")}
            >
              <strong className="text-text">{t("register.profile.owner")}</strong>
              <span className="text-sm text-muted">{t("register.profile.ownerHint")}</span>
            </button>
          </div>
          <Button fullWidth disabled={!role} onClick={() => setStep("account")}>
            {t("nextButton")}
          </Button>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="role" value={role ?? ""} />
          <h1 className="text-lg font-semibold text-text">{t("register.account.title")}</h1>
          <Input
            name="fullName"
            label={t("register.account.fullName")}
            autoComplete="name"
            required
            error={state.fieldErrors?.fullName}
          />
          <Input
            name="email"
            type="email"
            label={t("register.account.email")}
            autoComplete="email"
            required
            error={state.fieldErrors?.email}
          />
          <Input
            name="password"
            type="password"
            label={t("register.account.password")}
            hint={t("register.account.passwordHint")}
            autoComplete="new-password"
            required
            minLength={10}
            error={state.fieldErrors?.password}
          />
          {state.error ? (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep("profile")}>
              {t("backButton")}
            </Button>
            <Button type="submit" disabled={pending} fullWidth>
              {t("register.account.submit")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
