import type { RouteSeo } from "@/lib/seo";

/**
 * SEO de `/` — fonte de verdade versionada (P2-06 · 04 §2.1.2).
 *
 * Editável nas storyboards do canvas e, em produção, sobreponível em
 * `/admin/seo` sem deploy (07 §24.5). `check-seo` falha o PR se uma rota
 * pública ficar sem este ficheiro — ou sem um dos dois idiomas.
 */
export const seo: RouteSeo = {
  pt: {
    pageName: "Início",
    titleTag: "UProperty Market · Compre e venda imóveis sem comissões",
    metaDescription:
      "Compradores e proprietários falam diretamente, no seu ritmo, com informação transparente e controlo total do processo. Sem intermediários e sem comissões.",
  },
  en: {
    pageName: "Home",
    titleTag: "UProperty Market · Buy and sell property with no commission",
    metaDescription:
      "Buyers and owners talk directly, at their own pace, with transparent information and full control of the process. No middlemen and no commission.",
  },
};
