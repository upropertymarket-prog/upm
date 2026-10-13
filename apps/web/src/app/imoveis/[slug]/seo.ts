import type { PageSeo } from "@/lib/seo";

/**
 * Rota dinâmica: este registo é um **template** (04 §2.1.2). As variáveis
 * `{titulo}`, `{preco}`, `{localidade}` e `{tipologia}` são resolvidas no
 * `generateMetadata` da página com os dados do imóvel; sem `ogImage` definida,
 * usa a foto de capa e, em último caso, `/og/default.jpg`.
 */
export const seo: PageSeo = {
  pageName: "Propriedade (detalhe)",
  titleTag: "{titulo} · {tipologia} em {localidade} · UProperty Market",
  metaDescription:
    "{titulo} — {tipologia} em {localidade} por {preco}. Fale diretamente com o proprietário, sem comissões nem intermediários.",
  ogSameAsPage: true,
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  ogImageAlt: "{titulo}",
  canonical: "",
  noindex: false,
};
