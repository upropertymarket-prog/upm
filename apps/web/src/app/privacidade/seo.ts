import type { PageSeo } from "@/lib/seo";

/**
 * SEO de `/privacidade` — fonte de verdade versionada (P2-06 · 04 §2.1.2).
 *
 * Editável nas storyboards do canvas e, em produção, sobreponível em
 * `/admin/seo` sem deploy (07 §24.5). `check-seo` falha o PR se uma rota
 * pública ficar sem este ficheiro.

 */
export const seo: PageSeo = {
  pageName: "Política de Privacidade",
  titleTag: "Política de Privacidade · UProperty Market",
  metaDescription:
    "Como a UProperty Market trata os seus dados pessoais: finalidades, bases legais, prazos de conservação e os seus direitos.",
};
