import type { PageSeo } from "@/lib/seo";

/**
 * SEO de `/recuperar-palavra-passe` — fonte de verdade versionada (P2-06 · 04 §2.1.2).
 *
 * Editável nas storyboards do canvas e, em produção, sobreponível em
 * `/admin/seo` sem deploy (07 §24.5). `check-seo` falha o PR se uma rota
 * pública ficar sem este ficheiro.
 *
 * `noindex`: ecrã transacional, sem conteúdo indexável.
 */
export const seo: PageSeo = {
  pageName: "Recuperar palavra-passe",
  titleTag: "Recuperar palavra-passe · UProperty Market",
  metaDescription: "Recupere o acesso à sua conta UProperty Market.",
  noindex: true,
};
