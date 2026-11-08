import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requestAdminRecovery } from "./actions";
import { RecoverForm } from "./RecoverForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.staffRecovery");
  return { title: t("title"), robots: { index: false, follow: false, nocache: true } };
}

/** O "Esqueci-me da palavra-passe" do interno, só para admins — ver `actions.ts`. */
export default function StaffRecoverPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <RecoverForm onSubmit={requestAdminRecovery} />
      </div>
    </main>
  );
}
