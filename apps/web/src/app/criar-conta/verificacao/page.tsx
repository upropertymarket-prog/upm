import { getTranslations } from "next-intl/server";

import { AuthCard, AuthPage, AuthTitle } from "../../../components/auth/AuthLayout";
import { ResendVerificationForm } from "./ResendVerificationForm";
import { resendVerificationEmail } from "../actions";

/**
 * Verificação do e-mail — `/criar-conta/verificacao`
 * =========================================================================
 * Fase 9: esta página passou a ser também o regresso do Stripe Checkout. Três
 * estados, distinguidos por `?pago=`:
 *
 *   `pago=1`  — pagou. Falta confirmar o e-mail para entrar.
 *   `pago=0`  — desistiu do pagamento. A conta existe; a subscrição não.
 *   (ausente) — chegou aqui pelo caminho antigo, sem passar pelo pagamento.
 *
 * Dizer qual dos três é o caso importa: uma pessoa que acabou de pagar e vê
 * "verifique o seu e-mail" sem mais nada fica a pensar que o pagamento falhou.
 */
export default async function VerificationPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; pago?: string }>;
}) {
  const { email = "", pago } = await searchParams;
  const t = await getTranslations("auth.register.verification");

  return (
    <AuthPage>
      <AuthCard width="md" centered>
        <AuthTitle>{pago === "1" ? t("paidTitle") : t("title")}</AuthTitle>

        {pago === "1" ? (
          <p className="text-sm text-text">{t("paidBody")}</p>
        ) : pago === "0" ? (
          <p className="text-sm text-text">{t("unpaidBody")}</p>
        ) : null}

        <p className="text-sm text-muted">{t("body", { email })}</p>
        <ResendVerificationForm email={email} action={resendVerificationEmail} />
      </AuthCard>
    </AuthPage>
  );
}
