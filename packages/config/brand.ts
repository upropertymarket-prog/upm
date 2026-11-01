import type { Metadata } from "next";

/**
 * Ícones da marca para o `<head>` das três apps (07 §10.1)
 * =========================================================================
 * O favicon segue o tema do sistema operativo — o browser não sabe do tema
 * escolhido dentro da app, só do `prefers-color-scheme`. Os SVG estão em
 * `public/brand/` de cada app, copiados de `design/brand/icon-*.svg`.
 *
 * TODO: `apple-touch-icon` (180 px) e `favicon.ico` de recurso precisam de PNG
 * rasterizado a partir do SVG — o Safari do iOS não aceita SVG no ecrã inicial.
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
};
