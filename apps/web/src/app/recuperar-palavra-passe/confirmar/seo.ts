import type { RouteSeo } from "@/lib/seo";

/**
 * SEO de `/recuperar-palavra-passe/confirmar` (P3-03). `noindex`: passo de um fluxo.
 */
export const seo: RouteSeo = {
  pt: {
    pageName: "Definir nova palavra-passe",
    titleTag: "Nova palavra-passe · UProperty Market",
    metaDescription: "Defina uma nova palavra-passe para a sua conta.",
    noindex: true,
  },
  en: {
    pageName: "Set a new password",
    titleTag: "New password · UProperty Market",
    metaDescription: "Set a new password for your account.",
    noindex: true,
  },
};
