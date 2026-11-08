import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requestAdminRecovery } from "./actions";
import { AuthCard } from "../../components/AuthCard";
import { RecoverForm } from "./RecoverForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.staffRecovery");
  return { title: t("title"), robots: { index: false, follow: false, nocache: true } };
}

/** O "Esqueci-me da palavra-passe" do interno, só para admins — ver `actions.ts`. */
export default function StaffRecoverPage() {
  return (
    <AuthCard>
      <RecoverForm onSubmit={requestAdminRecovery} />
    </AuthCard>
  );
}
