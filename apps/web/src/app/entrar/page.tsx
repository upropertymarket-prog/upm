import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "./LoginForm";
import { signIn } from "./actions";

export const metadata: Metadata = {
  title: "Entrar · UProperty Market",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const t = await getTranslations("auth.login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <div className="relative mx-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <h1 className="text-lg font-semibold text-text">{t("title")}</h1>
        <LoginForm next={next} action={signIn} />
      </div>
    </main>
  );
}
