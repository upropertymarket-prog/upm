import type { PageSeo } from "@/lib/seo";

/**
 * SEO de `/termos` — fonte de verdade versionada (P2-06 · 04 §2.1.2).
 *
 * Editável nas storyboards do canvas e, em produção, sobreponível em
 * `/admin/seo` sem deploy (07 §24.5). `check-seo` falha o PR se uma rota
 * pública ficar sem este ficheiro.

 */
export const seo: PageSeo = {
  pageName: "Termos e Condições",
  titleTag: "Termos e Condições · UProperty Market",
  metaDescription:
    "Os Termos e Condições de utilização da plataforma UProperty Market, com versão e data de entrada em vigor.",
};
