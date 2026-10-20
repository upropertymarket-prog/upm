import type { RouteSeo } from "@/lib/seo";

/**
 * SEO de `/propriedades` — o catálogo público (P2-05).
 *
 * O `canonical` fixo que aqui estava (`https://upropertymarket.pt/propriedades`)
 * saiu a 20 out 2026. Eram dois defeitos num campo: anunciava o domínio de
 * produção **a partir de staging**, contra o que o `siteUrl()` do
 * `lib/seo.ts` existe para evitar, e prendia a página a um só URL agora que
 * ela tem dois (`/propriedades` e `/en/propriedades`). Sem o campo, o
 * `buildMetadata` calcula-o a partir da rota e do idioma — que é o que estava
 * certo desde o início.
 */
export const seo: RouteSeo = {
  pt: {
    pageName: "Propriedades",
    titleTag: "Propriedades sem comissões · UProperty Market",
    metaDescription:
      "Casas e apartamentos para comprar e arrendar, falando diretamente com quem vende. Sem comissões, sem intermediários e sem contactos indesejados.",
    ogSameAsPage: true,
    ogImageAlt: "Propriedades na UProperty Market",
    noindex: false,
  },
  en: {
    pageName: "Properties",
    titleTag: "Property with no commission · UProperty Market",
    metaDescription:
      "Houses and flats to buy and to rent, talking directly to the seller. No commission, no middlemen and no unwanted calls.",
    ogSameAsPage: true,
    ogImageAlt: "Properties on UProperty Market",
    noindex: false,
  },
};
