import { getTranslations } from "next-intl/server";

import { ResendVerificationForm } from "./ResendVerificationForm";

export default async function VerificationPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;
  const t = await getTranslations("auth.register.verification");

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold text-text">{t("title")}</h1>
        <p className="text-sm text-muted">{t("body", { email })}</p>
        <ResendVerificationForm email={email} />
      </div>
    </main>
  );
}
