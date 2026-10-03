import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card } from "@upm/ui";

export default async function SuspendedAccountPage() {
  const t = await getTranslations("auth.suspendedAccount");

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <Card padded className="w-full max-w-md">
        <div className="grid gap-4">
          <h1 className="text-xl font-semibold text-text">{t("title")}</h1>
          <p className="text-sm text-muted">{t("body")}</p>
          <Link className="upm-btn upm-btn--secondary upm-btn--md" href="/">
            {t("home")}
          </Link>
        </div>
      </Card>
    </main>
  );
}
