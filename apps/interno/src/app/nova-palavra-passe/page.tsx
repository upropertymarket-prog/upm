import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { setStaffPassword } from "./actions";
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
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <NewPasswordForm onSubmit={setStaffPassword} />
      </div>
    </main>
  );
}
