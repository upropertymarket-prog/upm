import { getTranslations } from "next-intl/server";

import { AuthShell } from "../../../components/auth/AuthLayout";
import { ResendVerificationForm } from "./ResendVerificationForm";
import { resendVerificationEmail } from "../actions";

import { buildMetadata } from "@/lib/seo";
import { seo } from "./seo";

/** Metadados a partir do `seo.ts` desta rota (P2-06). */
export function generateMetadata() {
  return buildMetadata(seo, "/criar-conta/verificacao");
}

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
  const [t, ts] = await Promise.all([
    getTranslations("auth.register.verification"),
    getTranslations("auth.shell"),
  ]);

  return (
    <AuthShell
      width="md"
      title={pago === "1" ? t("paidTitle") : t("title")}
      switchPrompt={ts("haveAccount")}
      switchHref="/entrar"
      switchLabel={ts("signIn")}
      legalLabel={ts("legal")}
      privacyLabel={ts("privacy")}
      cookiesLabel={ts("cookies")}
    >
      {pago === "1" ? (
        <p className="text-sm text-text">{t("paidBody")}</p>
      ) : pago === "0" ? (
        <p className="text-sm text-text">{t("unpaidBody")}</p>
      ) : null}

      <p className="text-sm text-muted">{t("body", { email })}</p>
      <ResendVerificationForm email={email} action={resendVerificationEmail} />
    </AuthShell>
  );
}
