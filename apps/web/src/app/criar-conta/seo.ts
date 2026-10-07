import type { PageSeo } from "@/lib/seo";

/**
 * SEO de `/criar-conta` — fonte de verdade versionada (P2-06 · 04 §2.1.2).
 *
 * Editável nas storyboards do canvas e, em produção, sobreponível em
 * `/admin/seo` sem deploy (07 §24.5). `check-seo` falha o PR se uma rota
 * pública ficar sem este ficheiro.

 */
export const seo: PageSeo = {
  pageName: "Criar conta",
  titleTag: "Criar conta · UProperty Market",
  metaDescription:
    "Crie a sua conta na UProperty Market e comece a comprar, vender ou arrendar sem comissões sobre a venda.",
};
