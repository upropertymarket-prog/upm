/// <reference path="../svg-assets.d.ts" />

import { cx } from "../lib/cx";
import bundledLightLogo from "./brand/logo-light.svg";
import bundledDarkLogo from "./brand/logo-dark.svg";

type ImportedAsset = string | { src: string };

function assetUrl(asset: ImportedAsset): string {
  return typeof asset === "string" ? asset : asset.src;
}

const bundledLightSrc = assetUrl(bundledLightLogo);
const bundledDarkSrc = assetUrl(bundledDarkLogo);

export type BrandProps = {
  /** `true` quando a sidebar está em rail (84 px) e o wordmark não cabe. */
  collapsed?: boolean;
  /** Texto alternativo do logótipo. Traduzido por quem usa. */
  alt?: string;
  lightSrc?: string;
  darkSrc?: string;
  className?: string;
};

/**
 * Brand — wordmark claro/escuro (04 §5.5 · 07 §10.1)
 * =========================================================================
 * Duas imagens, uma por tema, trocadas por CSS através dos tokens
 * `--logo-light` / `--logo-dark`. É como os protótipos fazem, e tem a vantagem
 * de o logótipo certo aparecer no primeiro paint, sem depender de JS.
 *
 * ⚠ ÍCONE DA MARCA — POR ENTREGAR (07 §10.1)
 * O `icon-mark.svg` que veio na pasta do cliente não era o ícone correto e foi
 * removido; o cliente entrega a versão final mais tarde. Até lá **não se
 * inventa nem se deriva um ícone** — nem a letra "U" num quadrado laranja que
 * os protótipos usavam como espaço reservado.
 *
 * Por isso o rail colapsado mostra um espaço reservado neutro, feito só de
 * borda tracejada e tokens, com o nome da marca em `aria-label` para não haver
 * um elemento sem nome acessível. Os outros sítios em falta (favicon,
 * apple-touch-icon, `og:image` por omissão, avatar do remetente das campanhas)
 * têm `TODO: ícone final` junto ao respetivo código.
 *
 * O canvas deste componente está em tempo/designs/design-system/app-shell/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function Brand({
  collapsed = false,
  alt = "UProperty Market",
  lightSrc = bundledLightSrc,
  darkSrc = bundledDarkSrc,
  className,
}: BrandProps) {
  if (collapsed) {
    return (
      <span
        className={cx("upm-brand__mark", className)}
        role="img"
        aria-label={alt}
        title={alt}
        // TODO: ícone final da marca (07 §10.1) — substituir este espaço
        // reservado pelo SVG entregue pelo cliente, sem o derivar do wordmark.
      />
    );
  }

  return (
    // O nome acessível está no invólucro, não nas imagens: só uma delas está
    // visível a cada momento e `display: none` tira-a da árvore de
    // acessibilidade — com o `alt` numa das imagens, o tema escuro ficaria sem
    // nome nenhum.
    <span className={cx("upm-brand", className)} role="img" aria-label={alt}>
      {/* `<img>` e não `next/image`: SVG estático de tamanho fixo servido do
          próprio domínio, onde a otimização do Next não traz nada — e usá-la
          obrigaria `packages/ui` a importar o Next em runtime. */}
      <img className="upm-brand__logo upm-brand__logo--light" src={lightSrc} alt="" />
      <img className="upm-brand__logo upm-brand__logo--dark" src={darkSrc} alt="" />
    </span>
  );
}
