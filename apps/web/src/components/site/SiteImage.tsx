import type { CSSProperties } from "react";

import type { SiteImageFile } from "../../lib/site-content";

/**
 * Uma fotografia do site, ou o seu espaço reservado (6 nov 2026)
 * =========================================================================
 * Sem `src`, desenha a caixa com o rótulo ("fotografia · interior"): a página
 * pode ser revista e aprovada antes de as fotografias chegarem, e o layout não
 * salta quando entram, porque a caixa já tem a proporção da imagem final.
 *
 * **`<img>` e não `next/image`.** As storyboards do canvas correm num host
 * Vite, sem o Next, e o `next/image` não renderiza lá — a página que se aprova
 * no canvas deixava de ser a que vai para produção. As fotografias entram já
 * otimizadas em `public/site/` (WebP, largura até 1600 px, ~200 KB cada).
 *
 * `priority` só no hero: é a única que se vê sem fazer scroll, e carregá-la
 * cedo é o que conta para o LCP. As outras esperam pela vez delas.
 */
export function SiteImage({
  image,
  label,
  aspectRatio,
  priority = false,
  rounded = true,
  showLabel = true,
  style,
}: {
  /** `null` desenha o espaço reservado. */
  image: SiteImageFile | null;
  /** O texto alternativo da fotografia e o rótulo do espaço reservado. */
  label: string;
  /** `undefined` deixa a altura vir do contentor (o hero, que preenche a coluna). */
  aspectRatio?: string;
  priority?: boolean;
  rounded?: boolean;
  /** `false` quando há texto por cima (a faixa): quem a usa põe o rótulo noutro sítio. */
  showLabel?: boolean;
  style?: CSSProperties;
}) {
  const moldura: CSSProperties = {
    aspectRatio,
    width: "100%",
    height: aspectRatio ? undefined : "100%",
    borderRadius: rounded ? "var(--r-lg)" : undefined,
    overflow: "hidden",
    ...style,
  };

  if (!image) {
    return (
      <div
        role="img"
        aria-label={label}
        style={{
          ...moldura,
          border: "1px solid var(--border)",
          background: "var(--surface2)",
          display: "grid",
          placeItems: "center",
          color: "var(--muted)",
          fontSize: "var(--fs-body)",
        }}
      >
        {showLabel ? label : null}
      </div>
    );
  }

  return (
    <div style={moldura}>
      {/* eslint-disable-next-line @next/next/no-img-element -- o canvas não tem o Next; ver a nota do ficheiro. */}
      <img
        src={image.src}
        alt={label}
        width={image.width}
        height={image.height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}
