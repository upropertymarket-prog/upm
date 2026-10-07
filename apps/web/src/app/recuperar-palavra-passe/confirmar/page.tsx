import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthShell } from "../../../components/auth/AuthLayout";
import { NewPasswordForm } from "./NewPasswordForm";
import { setNewPassword } from "../actions";

export const metadata: Metadata = {
  title: "Definir nova palavra-passe · UProperty Market",
};

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
