import { getTranslations } from "next-intl/server";

import { AuthShell } from "@/components/auth/AuthLayout";
import { RequestForm } from "./RequestForm";
import { requestPasswordReset } from "./actions";

import { pageMetadata } from "@/lib/seo-overrides";
import { seo } from "./seo";

/** `seo.ts` desta rota, com a sobreposição de `seo_pages` por cima (P2-06). */
export function generateMetadata() {
  return pageMetadata(seo, { pathname: "/recuperar-palavra-passe" });
}

export default async function RequestPasswordResetPage() {
  // O título e o subtítulo vivem no formulário: o pedido troca-os pelos de
  // "enviado" depois de submeter, e a moldura não sabe desse estado.
  const ts = await getTranslations("auth.shell");

  return (
    <AuthShell
      switchPrompt={ts("rememberedPassword")}
      switchHref="/entrar"
      switchLabel={ts("signIn")}
      legalLabel={ts("legal")}
      privacyLabel={ts("privacy")}
      cookiesLabel={ts("cookies")}
    >
      <RequestForm action={requestPasswordReset} />
    </AuthShell>
  );
}
