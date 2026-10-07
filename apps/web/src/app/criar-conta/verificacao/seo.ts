import type { PageSeo } from "@/lib/seo";

/**
 * SEO de `/criar-conta/verificacao` — fonte de verdade versionada (P2-06).
 *
 * `noindex`: ecrã transacional do registo, que só faz sentido para quem acabou
 * de criar conta. Indexá-lo poria nos resultados de pesquisa uma página que
 * pede a verificação de um e-mail que o visitante não submeteu.
 */
export const seo: PageSeo = {
  pageName: "Verificar e-mail",
  titleTag: "Verificar o e-mail · UProperty Market",
  metaDescription: "Confirme o seu endereço de e-mail para ativar a conta.",
  noindex: true,
};
