import type { RouteSeo } from "@/lib/seo";

/**
 * SEO de `/pre-inscricao/confirmar` (P2-02). `noindex`: é o destino de um link
 * de e-mail com um token no URL, não uma página do site. Indexá-la poria um
 * token de confirmação de alguém num resultado de pesquisa.
 */
export const seo: RouteSeo = {
  pt: {
    pageName: "Confirmar a pré-inscrição",
    titleTag: "Confirmar a pré-inscrição · UProperty Market",
    metaDescription: "Confirme o seu endereço de e-mail para completar a pré-inscrição.",
    noindex: true,
  },
  en: {
    pageName: "Confirm your early access",
    titleTag: "Confirm your early access · UProperty Market",
    metaDescription: "Confirm your email address to complete your early-access sign-up.",
    noindex: true,
  },
};
