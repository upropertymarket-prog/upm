import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.interno");
  return { title: t("login"), robots: { index: false, follow: false, nocache: true } };
}

export default async function InternoLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("auth.login");
  const params = await searchParams;
  const suspended = params.suspended === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <h1 className="text-lg font-semibold text-text">{t("title")}</h1>
        <LoginForm suspended={suspended} />
      </div>
    </main>
  );
}
