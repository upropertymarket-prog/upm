import type { PageSeo } from "@/lib/seo";

export const seo: PageSeo = {
  pageName: "Imóveis",
  titleTag: "Imóveis sem comissões · UProperty Market",
  metaDescription:
    "Casas e apartamentos para comprar e arrendar, falando diretamente com quem vende. Sem comissões, sem intermediários e sem contactos indesejados.",
  ogSameAsPage: true,
  ogTitle: "",
  ogDescription: "",
  // Deliberadamente vazio, e não "/og/imoveis.jpg". **Nenhuma imagem OG existe
  // neste projeto** — `apps/web/public/og/` não existe, e por isso até o
  // `/og/default.jpg` a que o `buildMetadata` cai devolve 404. Apontar para um
  // ficheiro inexistente não é melhor do que não apontar: é uma partilha sem
  // imagem nos dois casos, com a diferença de que o caminho escrito dá a
  // entender que está resolvido. Fica como **D63**.
  ogImage: "",
  ogImageAlt: "Imóveis na UProperty Market",
  canonical: "https://upropertymarket.pt/imoveis",
  noindex: false,
};
