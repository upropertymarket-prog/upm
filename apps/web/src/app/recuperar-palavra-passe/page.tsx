import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthShell } from "../../components/auth/AuthLayout";
import { RequestForm } from "./RequestForm";
import { requestPasswordReset } from "./actions";

export const metadata: Metadata = {
  title: "Recuperar palavra-passe · UProperty Market",
};

export default async function RequestPasswordResetPage() {
  const [t, ts] = await Promise.all([
    getTranslations("auth.recovery"),
    getTranslations("auth.shell"),
  ]);

  return (
    <AuthShell
      subtitle={t("subtitle")}
      switchPrompt={ts("rememberedPassword")}
      switchHref="/entrar"
      switchLabel={ts("signIn")}
      legalLabel={ts("legal")}
    >
      <RequestForm action={requestPasswordReset} />
    </AuthShell>
  );
}
