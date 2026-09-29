import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard, AuthPage, AuthTitle } from "../../components/auth/AuthLayout";
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
    <AuthPage>
      <AuthCard>
        <AuthTitle>{t("title")}</AuthTitle>
        <LoginForm next={next} action={signIn} />
      </AuthCard>
    </AuthPage>
  );
}
