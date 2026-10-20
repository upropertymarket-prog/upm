import type { RouteSeo } from "@/lib/seo";

/**
 * SEO de `/cancelar-subscricao` (P10-09).
 *
 * `noindex`: chega-se aqui por um link de um e-mail, com um token. Não é uma
 * página para encontrar numa pesquisa.
 */
export const seo: RouteSeo = {
  pt: {
    pageName: "Cancelar subscrição",
    titleTag: "Cancelar subscrição · UProperty Market",
    metaDescription: "Deixe de receber as comunicações de marketing da UProperty Market.",
    noindex: true,
  },
  en: {
    pageName: "Unsubscribe",
    titleTag: "Unsubscribe · UProperty Market",
    metaDescription: "Stop receiving marketing communications from UProperty Market.",
    noindex: true,
  },
};
