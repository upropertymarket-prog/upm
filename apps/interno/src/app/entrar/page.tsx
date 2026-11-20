import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "../../components/AuthCard";
import { signIn } from "./actions";
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
  const params = await searchParams;
  const suspended = params.suspended === "1";

  return (
    <AuthCard>
      <LoginForm onSubmit={signIn} suspended={suspended} />
    </AuthCard>
  );
}
