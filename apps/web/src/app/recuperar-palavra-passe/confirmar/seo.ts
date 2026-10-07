import type { PageSeo } from "@/lib/seo";

/**
 * SEO de `/recuperar-palavra-passe/confirmar` — versionado (P2-06).
 *
 * `noindex`: a página só funciona com o token que vem no link do e-mail. Sem
 * ele não tem conteúdo nenhum, e com ele não é para ser encontrada por
 * ninguém a não ser o titular.
 */
export const seo: PageSeo = {
  pageName: "Definir nova palavra-passe",
  titleTag: "Nova palavra-passe · UProperty Market",
  metaDescription: "Defina uma nova palavra-passe para a sua conta.",
  noindex: true,
};
