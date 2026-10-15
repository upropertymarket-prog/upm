import type { PageSeo } from "@/lib/seo";

/**
 * SEO de `/cancelar-subscricao` — fonte de verdade versionada (P2-06 · P10-08).
 *
 * `noindex`: é o destino do link de cancelar subscrição das campanhas (02
 * §4.3). Não tem conteúdo que sirva uma pesquisa, e indexá-la punha o
 * motor de busca a visitar URLs com tokens de destinatários.
 */
export const seo: PageSeo = {
  pageName: "Cancelar subscrição",
  titleTag: "Cancelar subscrição · UProperty Market",
  metaDescription: "Deixe de receber as comunicações de marketing da UProperty Market.",
  noindex: true,
};
