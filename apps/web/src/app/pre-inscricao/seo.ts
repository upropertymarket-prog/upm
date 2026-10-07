import type { PageSeo } from "@/lib/seo";

/**
 * SEO de `/pre-inscricao` — fonte de verdade versionada (P2-06).
 *
 * Indexável, ao contrário das outras rotas de formulário: em pré-lançamento
 * é a página de conversão do site, e é por ela que uma pesquisa pela marca
 * deve poder entrar.
 */
export const seo: PageSeo = {
  pageName: "Pré-inscrição",
  titleTag: "Pré-inscrição · UProperty Market",
  metaDescription:
    "Inscreva-se para ser avisado quando os primeiros imóveis abrirem, e garanta os valores de lançamento. Sem comissões sobre a venda.",
};
