"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, Checkbox, Input, Select } from "@upm/ui";

type Step = "profile" | "account" | "plan" | "contract";
type ProfileChoice = "buyer" | "owner";

/**
 * Definido aqui, não em `./actions`: `actions.ts` importa `next/headers`
 * (server-only) e importá-lo — mesmo só o tipo — parte a compilação do
 * canvas para o projeto inteiro. `./actions` importa este tipo daqui.
 */
export type RegisterState = {
  error?: string;
  fieldErrors?: Partial<Record<"fullName" | "email" | "password" | "taxId" | "phone", string>>;
  /** Para onde o formulário volta quando a recusa é de um campo concreto. */
  step?: Step;
  /** URL do Stripe Checkout. Chega preenchido quando tudo o resto passou. */
  checkoutUrl?: string;
};

const initialState: RegisterState = {};

export type RegisterPlan = {
  slug: string;
  name: string;
  priceMonthCents: number;
  priceYearCents: number;
  features: string[];
  audience: "owner" | "buyer" | "both";
};

export type RegisterTerms = {
  documentId: string;
  version: string;
  contentHash: string;
  pendingLegalReview: boolean;
};

export type RegisterWizardProps = {
  /**
   * Injetada pela página (`action={registerAccount}`), nunca importada aqui:
   * puxa `next/headers` (server-only), e importá-lo neste componente parte a
   * compilação do canvas para o projeto inteiro. O canvas passa uma ação de
   * demonstração em vez da real.
   */
  action: (state: RegisterState, formData: FormData) => Promise<RegisterState>;
  plans: RegisterPlan[];
  /** `null` quando não há versão publicada — a contratação não pode avançar. */
  terms: RegisterTerms | null;
};

function money(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
}

/**
 * Registo com contratação paga (Fase 9 — P9-01, P9-02, P9-09)
 * =========================================================================
 * Quatro passos, **uma só submissão**: Perfil → Conta → Plano → Contratação.
 * Tudo o que o utilizador escreve fica no cliente até ao fim; a conta, a
 * aceitação dos Termos e o Checkout nascem todos na mesma chamada ao servidor.
 *
 * Não há degrau gratuito e não há trial (decisão do cliente, 7 out 2026): o
 * botão final diz o que faz — leva ao pagamento.
 *
 * O compromisso mínimo **não está decidido**, por isso o ecrã mostra a sua
 * ausência em texto e nunca um número (P9-09).
 */
export function RegisterWizard({ action, plans, terms }: RegisterWizardProps) {
  const t = useTranslations("auth");
  const tc = useTranslations("auth.register.contract");
  const [step, setStep] = useState<Step>("profile");
  const [role, setRole] = useState<ProfileChoice | null>(null);
  const [planSlug, setPlanSlug] = useState<string | null>(null);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [state, formAction, pending] = useActionState(action, initialState);

  // Uma recusa de campo devolve o passo onde o campo vive, para o utilizador
  // não ter de refazer a navegação à procura dele.
  useEffect(() => {
    if (state.step) setStep(state.step);
  }, [state.step]);

  useEffect(() => {
    if (state.checkoutUrl) window.location.href = state.checkoutUrl;
  }, [state.checkoutUrl]);

  const visiblePlans = plans.filter((plan) => plan.audience === "both" || plan.audience === role);
  const chosen = visiblePlans.find((plan) => plan.slug === planSlug) ?? null;
  const cents = chosen
    ? interval === "month"
      ? chosen.priceMonthCents
      : chosen.priceYearCents
    : 0;

  const steps: { id: Step; label: string }[] = [
    { id: "profile", label: t("register.steps.profile") },
    { id: "account", label: t("register.steps.account") },
    { id: "plan", label: t("register.steps.plan") },
    { id: "contract", label: t("register.steps.contract") },
  ];

  return (
    <Card padded className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <ol className="flex flex-wrap gap-4 text-sm text-muted" aria-label={t("register.title")}>
        {steps.map((item) => (
          <li
            key={item.id}
            aria-current={step === item.id ? "step" : undefined}
            className="aria-[current]:text-accent aria-[current]:font-semibold"
          >
            {item.label}
          </li>
        ))}
      </ol>

      {/*
        Um `form` só, sempre montado: os passos anteriores ficam no DOM como
        campos escondidos, e é isso que permite submeter tudo de uma vez sem
        guardar estado no servidor entre páginas.

        Os campos dos passos anteriores NÃO levam `required` nem `minLength`: um
        campo obrigatório dentro de um `div hidden` faz o browser recusar a
        submissão com "an invalid form control is not focusable" — e sem dizer
        qual. A validação é do servidor (08 §7.8), que devolve o erro e o passo
        onde ele vive. A caixa dos Termos leva `required` porque está visível no
        momento da submissão.
      */}
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="role" value={role ?? ""} />
        <input type="hidden" name="planSlug" value={planSlug ?? ""} />
        <input type="hidden" name="interval" value={interval} />
        <input type="hidden" name="termsDocumentId" value={terms?.documentId ?? ""} />
        <input type="hidden" name="termsContentHash" value={terms?.contentHash ?? ""} />

        <div hidden={step !== "profile"}>
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
        </div>

        <div hidden={step !== "account"}>
          <div className="flex flex-col gap-4">
            <h1 className="text-lg font-semibold text-text">{t("register.account.title")}</h1>
            <Input
              name="fullName"
              label={t("register.account.fullName")}
              autoComplete="name"
              error={state.fieldErrors?.fullName}
            />
            <Input
              name="taxId"
              label={t("register.account.taxId")}
              hint={t("register.account.taxIdHint")}
              inputMode="numeric"
              autoComplete="off"
              maxLength={11}
              error={state.fieldErrors?.taxId}
            />
            <Input
              name="phone"
              type="tel"
              label={t("register.account.phone")}
              hint={t("register.account.phoneHint")}
              autoComplete="tel"
              error={state.fieldErrors?.phone}
            />
            <Input
              name="email"
              type="email"
              label={t("register.account.email")}
              autoComplete="email"
              error={state.fieldErrors?.email}
            />
            <Input
              name="password"
              type="password"
              label={t("register.account.password")}
              hint={t("register.account.passwordHint")}
              autoComplete="new-password"
              error={state.fieldErrors?.password}
            />
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep("profile")}>
                {t("backButton")}
              </Button>
              <Button type="button" fullWidth onClick={() => setStep("plan")}>
                {t("nextButton")}
              </Button>
            </div>
          </div>
        </div>

        <div hidden={step !== "plan"}>
          <div className="flex flex-col gap-4">
            <h1 className="text-lg font-semibold text-text">{t("register.plan.title")}</h1>
            <p className="text-sm text-muted">{t("register.plan.hint")}</p>

            <Select
              name="intervalChoice"
              label={t("register.plan.intervalLabel")}
              value={interval}
              onChange={(event) => setInterval(event.target.value === "year" ? "year" : "month")}
              options={[
                { value: "month", label: t("register.plan.monthly") },
                { value: "year", label: t("register.plan.yearly") },
              ]}
            />

            <div className="flex flex-col gap-3">
              {visiblePlans.map((plan) => (
                <button
                  key={plan.slug}
                  type="button"
                  className="flex flex-col gap-1 rounded-xl border border-border p-4 text-left hover:border-accent data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft"
                  data-selected={planSlug === plan.slug ? "true" : undefined}
                  onClick={() => setPlanSlug(plan.slug)}
                >
                  <strong className="text-text">{plan.name}</strong>
                  <span className="text-sm text-text">
                    {money(
                      interval === "month" ? plan.priceMonthCents : plan.priceYearCents,
                      "pt-PT",
                    )}
                    {interval === "month"
                      ? t("register.plan.perMonth")
                      : t("register.plan.perYear")}
                  </span>
                  {plan.features.length > 0 ? (
                    <span className="text-sm text-muted">{plan.features.join(" · ")}</span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep("account")}>
                {t("backButton")}
              </Button>
              <Button
                type="button"
                fullWidth
                disabled={!planSlug}
                onClick={() => setStep("contract")}
              >
                {t("nextButton")}
              </Button>
            </div>
          </div>
        </div>

        <div hidden={step !== "contract"}>
          <div className="flex flex-col gap-4">
            <h1 className="text-lg font-semibold text-text">{tc("title")}</h1>

            {terms?.pendingLegalReview ? (
              <p
                role="note"
                className="rounded-xl border border-border px-4 py-3 text-sm"
                style={{ background: "var(--warn-soft, var(--surface-2))" }}
              >
                {tc("pendingReview")}
              </p>
            ) : null}

            <dl className="grid gap-2 rounded-xl border border-border p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{tc("plan")}</dt>
                <dd className="text-text">{chosen?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{tc("price")}</dt>
                <dd className="text-text">{money(cents, "pt-PT")}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{tc("interval")}</dt>
                <dd className="text-text">
                  {interval === "month" ? tc("intervalMonth") : tc("intervalYear")}
                </dd>
              </div>
              {/*
                P9-09: o compromisso mínimo não está decidido, por isso mostra-se
                a AUSÊNCIA dele. Nunca um número, nunca um travessão a fingir de
                valor.
              */}
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{tc("commitment")}</dt>
                <dd className="text-text">{tc("commitmentNone")}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{tc("renewal")}</dt>
                <dd className="text-text">
                  {interval === "month" ? tc("renewalMonth") : tc("renewalYear")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{tc("cancellation")}</dt>
                <dd className="text-text">{tc("cancellationRule")}</dd>
              </div>
            </dl>

            <p className="text-sm text-muted">{tc("withdrawal")}</p>

            <Checkbox
              name="acceptTerms"
              required
              label={
                <span>
                  {tc("acceptPrefix")}{" "}
                  <a
                    href="/termos"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline"
                  >
                    {tc("acceptLink")}
                  </a>
                  {terms ? ` (${tc("version", { version: terms.version })})` : null}
                </span>
              }
            />

            {state.error ? (
              <p className="text-sm text-danger" role="alert">
                {state.error}
              </p>
            ) : null}

            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep("plan")}>
                {t("backButton")}
              </Button>
              <Button type="submit" fullWidth disabled={pending || !terms || !chosen}>
                {pending ? tc("submitting") : tc("submit")}
              </Button>
            </div>

            {!terms ? (
              <p className="text-sm text-danger" role="alert">
                {tc("noTerms")}
              </p>
            ) : null}
          </div>
        </div>

        {state.error && step !== "contract" ? (
          <p className="text-sm text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
