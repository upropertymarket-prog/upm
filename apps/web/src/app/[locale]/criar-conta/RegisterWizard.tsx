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
  /**
   * Oferta do 1.º ano (13 nov 2026): o preço dos primeiros `introMonths` meses.
   * `null` = sem oferta. O preço normal continua em `price*Cents`.
   */
  introMonthCents: number | null;
  introYearCents: number | null;
  introMonths: number | null;
  features: string[];
  audience: "owner" | "buyer" | "both";
  /**
   * Período mínimo que se aplica a este plano, em meses. `null` = nenhum.
   * Resolvido no servidor a partir da configuração — nunca escrito aqui.
   */
  commitmentMonths: number | null;
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
  /**
   * Estado de arranque do assistente. **A página real não o passa** — quem
   * chega a `/criar-conta` começa sempre no Perfil, e é assim que deve ser.
   *
   * Existe para o canvas, pela mesma razão que `AppChrome` tem
   * `liveNotifications`: o passo da Contratação é o momento em que a pessoa
   * aceita o contrato e autoriza o pagamento, e era o único ecrã do registo
   * que **nenhuma storyboard conseguia mostrar** — para lá chegar é preciso
   * escolher perfil, preencher a conta e escolher plano, e uma captura não
   * clica. Sem isto, o ecrã mais delicado do produto revia-se no browser ou
   * não se revia.
   *
   * Não abre caminho nenhum: tudo o que fixa é estado de interface que o
   * utilizador podia pôr sozinho em três cliques. A validação continua toda no
   * servidor (08 §7.8), que não lê nada daqui.
   */
  initialSelection?: {
    step?: Step;
    role?: ProfileChoice;
    planSlug?: string;
    interval?: "month" | "year";
  };
};

function money(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** O preço normal e, se houver oferta, o do 1.º ano, na periodicidade escolhida. */
function pricesFor(plan: RegisterPlan, interval: "month" | "year") {
  const cents = interval === "month" ? plan.priceMonthCents : plan.priceYearCents;
  const intro = interval === "month" ? plan.introMonthCents : plan.introYearCents;
  return { cents, intro: intro !== null && plan.introMonths !== null ? intro : null };
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
 * O **período mínimo** aparece no passo da contratação, antes do pagamento,
 * com o valor que vem da configuração (12 meses desde 7 out 2026). Quando não
 * houver nenhum, mostra-se a ausência dele — nunca um zero (P9-09).
 */
export function RegisterWizard({ action, plans, terms, initialSelection }: RegisterWizardProps) {
  const t = useTranslations("auth");
  const tc = useTranslations("auth.register.contract");
  const [step, setStep] = useState<Step>(initialSelection?.step ?? "profile");
  const [role, setRole] = useState<ProfileChoice | null>(initialSelection?.role ?? null);
  const [planSlug, setPlanSlug] = useState<string | null>(initialSelection?.planSlug ?? null);
  const [interval, setInterval] = useState<"month" | "year">(initialSelection?.interval ?? "month");
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
  const chosenPrices = chosen ? pricesFor(chosen, interval) : { cents: 0, intro: null };
  const per = interval === "month" ? t("register.plan.perMonth") : t("register.plan.perYear");

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
              {visiblePlans.map((plan) => {
                const prices = pricesFor(plan, interval);
                return (
                  <button
                    key={plan.slug}
                    type="button"
                    className="flex flex-col gap-1 rounded-xl border border-border p-4 text-left hover:border-accent data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft"
                    data-selected={planSlug === plan.slug ? "true" : undefined}
                    onClick={() => setPlanSlug(plan.slug)}
                  >
                    <strong className="text-text">{plan.name}</strong>
                    {/* O preço normal riscado e o do 1.º ano a seguir, como no site. */}
                    <span className="flex flex-wrap items-baseline gap-x-2 text-sm text-text">
                      {prices.intro !== null ? (
                        <s className="text-muted">
                          <span className="sr-only">{t("register.plan.wasPrice")}: </span>
                          {money(prices.cents, "pt-PT")}
                        </s>
                      ) : null}
                      <span className={prices.intro !== null ? "font-semibold" : undefined}>
                        {money(prices.intro ?? prices.cents, "pt-PT")}
                        {per}
                      </span>
                    </span>
                    {prices.intro !== null ? (
                      <span className="text-sm text-muted">
                        {t("register.plan.introNote", {
                          months: plan.introMonths as number,
                          price: `${money(prices.cents, "pt-PT")}${per}`,
                        })}
                      </span>
                    ) : null}
                    {plan.features.length > 0 ? (
                      <span className="text-sm text-muted">{plan.features.join(" · ")}</span>
                    ) : null}
                  </button>
                );
              })}
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
              {/*
                Com oferta, o contrato diz os DOIS preços e quando muda um para o
                outro — riscar um preço é para a montra; aqui é o que se aceita
                pagar, e o DL 24/2014 (art. 4.º) quer o preço total antes da
                celebração.
              */}
              {chosen && chosenPrices.intro !== null ? (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">
                      {tc("introPrice", { months: chosen.introMonths as number })}
                    </dt>
                    <dd className="text-text">{money(chosenPrices.intro, "pt-PT")}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">{tc("priceAfter")}</dt>
                    <dd className="text-text">{money(chosenPrices.cents, "pt-PT")}</dd>
                  </div>
                </>
              ) : (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{tc("price")}</dt>
                  <dd className="text-text">{money(chosenPrices.cents, "pt-PT")}</dd>
                </div>
              )}
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
                <dd className="text-text">
                  {chosen?.commitmentMonths
                    ? tc("commitmentMonths", { months: chosen.commitmentMonths })
                    : tc("commitmentNone")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{tc("renewal")}</dt>
                <dd className="text-text">
                  {interval === "month" ? tc("renewalMonth") : tc("renewalYear")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{tc("cancellation")}</dt>
                <dd className="text-text">
                  {chosen?.commitmentMonths
                    ? tc("cancellationWithCommitment")
                    : tc("cancellationRule")}
                </dd>
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

            {/*
              D69 — o consentimento de marketing, que o registo nunca recolheu.
              `profiles.marketing_consent` existe desde `20261015090000` e nascia
              sempre `false`, e por isso as audiências de campanha a registados
              davam zero: não havia uma única conta que o tivesse dado.

              **Separado dos Termos e sem `required`.** Os Termos autorizam o
              tratamento e são obrigatórios; isto é opcional e tem de o ser,
              senão não é consentimento. Nunca pré-selecionado — P11-07 é
              explícito ("sem caixas pré-selecionadas"), e é a mesma regra que o
              formulário de pré-inscrição já cumpre.
            */}
            <Checkbox name="marketingConsent" label={tc("marketing")} hint={tc("marketingHint")} />

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
