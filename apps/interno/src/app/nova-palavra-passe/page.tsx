import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { setStaffPassword } from "./actions";
import { AuthCard } from "../../components/AuthCard";
import { NewPasswordForm } from "./NewPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.recovery");
  return { title: t("newPasswordTitle"), robots: { index: false, follow: false, nocache: true } };
}

/**
 * Onde o link de recuperação leva (`auth/confirmar`). Exige a sessão do link;
 * sem ela o middleware manda para `/entrar`.
 */
export default function StaffNewPasswordPage() {
  return (
    <AuthCard>
      <NewPasswordForm onSubmit={setStaffPassword} />
    </AuthCard>
  );
}
