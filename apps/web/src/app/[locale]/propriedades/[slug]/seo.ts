import type { RouteSeo } from "@/lib/seo";

/**
 * SEO do detalhe de uma propriedade — `/propriedades/[slug]` (04 §2.1.2).
 *
 * As chaves entre chaves são o template de 04 §2.1.2, resolvido na
 * `page.tsx` com os dados do imóvel. **Os nomes das variáveis são os mesmos
 * nos dois idiomas** — é o template que muda de língua, não a variável: um
 * `{titulo}` traduzido obrigava o `fill()` a saber em que idioma está para
 * saber o que substituir, e isso é um sítio a mais onde se erra.
 */
export const seo: RouteSeo = {
  pt: {
    pageName: "Propriedade (detalhe)",
    titleTag: "{titulo} · {tipologia} em {localidade} · UProperty Market",
    metaDescription:
      "{titulo} — {tipologia} em {localidade} por {preco}. Fale diretamente com o proprietário, sem comissões nem intermediários.",
    ogSameAsPage: true,
    ogImageAlt: "{titulo}",
    noindex: false,
  },
  en: {
    pageName: "Property (detail)",
    titleTag: "{titulo} · {tipologia} in {localidade} · UProperty Market",
    metaDescription:
      "{titulo} — {tipologia} in {localidade} for {preco}. Talk directly to the owner, with no commission and no middlemen.",
    ogSameAsPage: true,
    ogImageAlt: "{titulo}",
    noindex: false,
  },
};
