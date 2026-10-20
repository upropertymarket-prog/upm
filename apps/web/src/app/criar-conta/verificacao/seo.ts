import type { RouteSeo } from "@/lib/seo";

/**
 * SEO de `/criar-conta/verificacao` (P3-01).
 *
 * `noindex`: é um passo de um fluxo, não uma página para alguém encontrar
 * numa pesquisa.
 */
export const seo: RouteSeo = {
  pt: {
    pageName: "Verificar e-mail",
    titleTag: "Verificar o e-mail · UProperty Market",
    metaDescription: "Confirme o seu endereço de e-mail para ativar a conta.",
    noindex: true,
  },
  en: {
    pageName: "Verify email",
    titleTag: "Verify your email · UProperty Market",
    metaDescription: "Confirm your email address to activate the account.",
    noindex: true,
  },
};
