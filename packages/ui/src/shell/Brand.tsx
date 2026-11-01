import { cx } from "../lib/cx";
import bundledLightLogo from "./brand/logo-light.svg";
import bundledDarkLogo from "./brand/logo-dark.svg";
import bundledLightIcon from "./brand/icon-light.svg";
import bundledDarkIcon from "./brand/icon-dark.svg";

function assetUrl(asset: string | { src: string }): string {
  return typeof asset === "string" ? asset : asset.src;
}

const bundledLightSrc = assetUrl(bundledLightLogo);
const bundledDarkSrc = assetUrl(bundledDarkLogo);
const bundledLightIconSrc = assetUrl(bundledLightIcon);
const bundledDarkIconSrc = assetUrl(bundledDarkIcon);

export type BrandProps = {
  /** `true` quando a sidebar está em rail (84 px): mostra o ícone em vez do wordmark. */
  collapsed?: boolean;
  /** Texto alternativo do logótipo. Traduzido por quem usa. */
  alt?: string;
  lightSrc?: string;
  darkSrc?: string;
  lightIconSrc?: string;
  darkIconSrc?: string;
  className?: string;
};

/**
 * Brand — wordmark e ícone, claro/escuro (04 §5.5 · 07 §10.1)
 * =========================================================================
 * Duas imagens, uma por tema, trocadas por CSS através dos tokens
 * `--logo-light` / `--logo-dark`. É como os protótipos fazem, e tem a vantagem
 * de a marca certa aparecer no primeiro paint, sem depender de JS.
 *
 * Com `collapsed` o wordmark não cabe nos 84 px do rail e entra o ícone da
 * marca — o SVG entregue pelo cliente a 29 out 2026 (`design/brand/icon-*.svg`).
 * O ícone traz o seu próprio quadrado de fundo; a CSS não lhe põe moldura.
 *
 * O canvas deste componente está em tempo/designs/design-system/app-shell/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function Brand({
  collapsed = false,
  alt = "UProperty Market",
  lightSrc = bundledLightSrc,
  darkSrc = bundledDarkSrc,
  lightIconSrc = bundledLightIconSrc,
  darkIconSrc = bundledDarkIconSrc,
  className,
}: BrandProps) {
  if (collapsed) {
    return (
      <span className={cx("upm-brand__mark", className)} role="img" aria-label={alt} title={alt}>
        <img className="upm-brand__icon upm-brand__logo--light" src={lightIconSrc} alt="" />
        <img className="upm-brand__icon upm-brand__logo--dark" src={darkIconSrc} alt="" />
      </span>
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
