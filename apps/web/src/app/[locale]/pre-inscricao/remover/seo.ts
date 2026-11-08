import type { RouteSeo } from "@/lib/seo";

/**
 * SEO de `/pre-inscricao/remover` (8 nov 2026). `noindex`: é o destino de um
 * link de e-mail com um token no URL, como `/pre-inscricao/confirmar`.
 */
export const seo: RouteSeo = {
  pt: {
    pageName: "Remover a pré-inscrição",
    titleTag: "Remover a pré-inscrição · UProperty Market",
    metaDescription: "Apague a sua pré-inscrição e os dados que deixou.",
    noindex: true,
  },
  en: {
    pageName: "Remove your early access",
    titleTag: "Remove your early access · UProperty Market",
    metaDescription: "Delete your early-access sign-up and the details you left.",
    noindex: true,
  },
};
