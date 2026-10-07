import { getTranslations } from "next-intl/server";

import { AuthShell } from "../../../components/auth/AuthLayout";
import { NewPasswordForm } from "./NewPasswordForm";
import { setNewPassword } from "../actions";

import { buildMetadata } from "@/lib/seo";
import { seo } from "./seo";

/** Metadados a partir do `seo.ts` desta rota (P2-06). */
export function generateMetadata() {
  return buildMetadata(seo, "/recuperar-palavra-passe/confirmar");
}

export default async function ConfirmNewPasswordPage() {
  const [t, ts] = await Promise.all([
    getTranslations("auth.recovery"),
    getTranslations("auth.shell"),
  ]);

  return (
    <AuthShell
      subtitle={t("newPasswordSubtitle")}
      switchPrompt={ts("rememberedPassword")}
      switchHref="/entrar"
      switchLabel={ts("signIn")}
      legalLabel={ts("legal")}
      privacyLabel={ts("privacy")}
      cookiesLabel={ts("cookies")}
    >
      <NewPasswordForm action={setNewPassword} />
    </AuthShell>
  );
}
