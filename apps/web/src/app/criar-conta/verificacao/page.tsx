import { getTranslations } from "next-intl/server";

import { AuthCard, AuthPage, AuthTitle } from "../../../components/auth/AuthLayout";
import { ResendVerificationForm } from "./ResendVerificationForm";
import { resendVerificationEmail } from "../actions";

export default async function VerificationPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;
  const t = await getTranslations("auth.register.verification");

  return (
    <AuthPage>
      <AuthCard width="md" centered>
        <AuthTitle>{t("title")}</AuthTitle>
        <p className="text-sm text-muted">{t("body", { email })}</p>
        <ResendVerificationForm email={email} action={resendVerificationEmail} />
      </AuthCard>
    </AuthPage>
  );
}
