import type { PageSeo } from "@/lib/seo";

/**
 * SEO de `/entrar` — fonte de verdade versionada (P2-06 · 04 §2.1.2).
 *
 * Editável nas storyboards do canvas e, em produção, sobreponível em
 * `/admin/seo` sem deploy (07 §24.5). `check-seo` falha o PR se uma rota
 * pública ficar sem este ficheiro.
 *
 * `noindex`: um ecrã de login não tem conteúdo que sirva a ninguém numa
 * pesquisa, e indexá-lo só dilui o domínio.
 */
export const seo: PageSeo = {
  pageName: "Entrar",
  titleTag: "Entrar · UProperty Market",
  metaDescription: "Acesso à sua conta UProperty Market.",
  noindex: true,
};
