import { getTranslations } from "next-intl/server";

import { AuthShell } from "@/components/auth/AuthLayout";
import { LoginForm } from "./LoginForm";
import { signIn } from "./actions";

import { pageMetadata } from "@/lib/seo-overrides";
import { seo } from "./seo";

/** `seo.ts` desta rota, com a sobreposição de `seo_pages` por cima (P2-06). */
export function generateMetadata() {
  return pageMetadata(seo, "/entrar");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const [t, ts] = await Promise.all([getTranslations("auth.login"), getTranslations("auth.shell")]);

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      switchPrompt={ts("noAccount")}
      switchHref="/criar-conta"
      switchLabel={ts("createAccount")}
      legalLabel={ts("legal")}
      privacyLabel={ts("privacy")}
      cookiesLabel={ts("cookies")}
    >
      <LoginForm next={next} action={signIn} />
    </AuthShell>
  );
}
