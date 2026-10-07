import type { PageSeo } from "@/lib/seo";

/**
 * SEO de `/` — fonte de verdade versionada (P2-06 · 04 §2.1.2).
 *
 * Editável nas storyboards do canvas e, em produção, sobreponível em
 * `/admin/seo` sem deploy (07 §24.5). `check-seo` falha o PR se uma rota
 * pública ficar sem este ficheiro.

 */
export const seo: PageSeo = {
  pageName: "Início",
  titleTag: "UProperty Market · Imóveis sem comissões",
  metaDescription:
    "Compradores e proprietários falam diretamente, no seu ritmo, com informação transparente e controlo total do processo. Sem intermediários e sem comissões.",
};
