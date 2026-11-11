import type { Metadata } from "next";

/**
 * Ícones da marca para o `<head>` das três apps (07 §10.1)
 * =========================================================================
 * O favicon é sempre o de fundo claro com o U em azul escuro (cliente, 11 nov
 * 2026). Até aqui seguia o `prefers-color-scheme` e, com o sistema em escuro,
 * mostrava a versão escura — que o cliente não quer como ícone da marca. Os
 * SVG estão em `public/brand/` de cada app, copiados de
 * `design/brand/icon-*.svg`; o `icon-dark.svg` fica lá, sem uso no `<head>`.
 *
 * O `apple-touch-icon` (8 nov 2026) é o mesmo ícone em PNG de 180 px — o
 * Safari do iOS não aceita SVG no ecrã inicial. Rasterizado do
 * `icon-light.svg`, com os cantos preenchidos pelo fundo do próprio ícone: o
 * iOS arredonda-o sozinho e pintaria de preto um canto transparente.
 */
export const BRAND_ICONS: Metadata["icons"] = {
  icon: [{ url: "/brand/icon-light.svg", type: "image/svg+xml" }],
  apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
};
