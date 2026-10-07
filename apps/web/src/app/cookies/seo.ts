import type { PageSeo } from "@/lib/seo";

/**
 * SEO de `/cookies` — fonte de verdade versionada (P2-06 · 04 §2.1.2).
 *
 * Editável nas storyboards do canvas e, em produção, sobreponível em
 * `/admin/seo` sem deploy (07 §24.5). `check-seo` falha o PR se uma rota
 * pública ficar sem este ficheiro.

 */
export const seo: PageSeo = {
  pageName: "Política de Cookies",
  titleTag: "Política de Cookies · UProperty Market",
  metaDescription:
    "Que cookies e tecnologias semelhantes a UProperty Market utiliza, e como pode controlá-los.",
};
