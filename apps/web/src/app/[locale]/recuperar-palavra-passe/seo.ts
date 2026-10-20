import type { RouteSeo } from "@/lib/seo";

/**
 * SEO de `/recuperar-palavra-passe` (P3-03). `noindex`: passo de um fluxo.
 */
export const seo: RouteSeo = {
  pt: {
    pageName: "Recuperar palavra-passe",
    titleTag: "Recuperar palavra-passe · UProperty Market",
    metaDescription: "Recupere o acesso à sua conta UProperty Market.",
    noindex: true,
  },
  en: {
    pageName: "Reset password",
    titleTag: "Reset your password · UProperty Market",
    metaDescription: "Get back into your UProperty Market account.",
    noindex: true,
  },
};
