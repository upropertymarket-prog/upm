import type { Metadata } from "next";

/**
 * Ícones da marca para o `<head>` das três apps (07 §10.1)
 * =========================================================================
 * O favicon segue o tema do sistema operativo — o browser não sabe do tema
 * escolhido dentro da app, só do `prefers-color-scheme`. Os SVG estão em
 * `public/brand/` de cada app, copiados de `design/brand/icon-*.svg`.
 *
 * O `apple-touch-icon` (8 nov 2026) é o mesmo ícone em PNG de 180 px — o
 * Safari do iOS não aceita SVG no ecrã inicial. Rasterizado do
 * `icon-light.svg`, com os cantos preenchidos pelo fundo do próprio ícone: o
 * iOS arredonda-o sozinho e pintaria de preto um canto transparente.
 */
export const BRAND_ICONS: Metadata["icons"] = {
  icon: [
    {
      url: "/brand/icon-light.svg",
      type: "image/svg+xml",
      media: "(prefers-color-scheme: light)",
    },
    {
      url: "/brand/icon-dark.svg",
      type: "image/svg+xml",
      media: "(prefers-color-scheme: dark)",
    },
  ],
  apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
};
