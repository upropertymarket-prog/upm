import type { ReactNode } from "react";

/**
 * Moldura das secções do site público (P2-01)
 * =========================================================================
 * O `www` **não** usa o shell da app nem o limite de 1600 px de 04 §1.5 — tem
 * "o seu próprio ritmo de larguras" (03 §1.1). Esta é essa medida, num sítio
 * só: largura máxima de 1200 px para texto e cartões, com uma goteira de 16 px
 * que a regra de responsividade do projeto exige a 360 px.
 *
 * `scroll-margin-top` acompanha a navbar fixa: sem ele, uma âncora de menu
 * deixa o título debaixo da barra, o que é a diferença entre um menu que
 * funciona e um que parece quebrado.
 */

export const SITE_MAX_WIDTH = "1200px";

export function SiteSection({
  id,
  children,
  tone = "default",
}: {
  id?: string;
  children: ReactNode;
  /** `alt` alterna o fundo, para as secções se distinguirem ao scroll. */
  tone?: "default" | "alt";
}) {
  return (
    <section
      id={id}
      style={{
        background: tone === "alt" ? "var(--surface2)" : "var(--bg)",
        borderTop: tone === "alt" ? "1px solid var(--border)" : undefined,
        borderBottom: tone === "alt" ? "1px solid var(--border)" : undefined,
        // 84 px é a altura da navbar fixa do protótipo.
        scrollMarginTop: "84px",
        // `clamp` e não media query: a altura da secção acompanha o viewport
        // sem pontos de rutura (ver a nota de responsividade do projeto).
        padding: "clamp(2.5rem, 6vw, 5.5rem) 16px",
      }}
    >
      <div style={{ maxWidth: SITE_MAX_WIDTH, margin: "0 auto" }}>{children}</div>
    </section>
  );
}

/** Sobretítulo + título + corpo, o cabeçalho que todas as secções repetem. */
export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  align?: "left" | "center";
}) {
  return (
    <header
      style={{
        display: "grid",
        gap: "var(--sp-3)",
        textAlign: align,
        justifyItems: align === "center" ? "center" : "start",
        maxWidth: align === "center" ? "46rem" : "40rem",
        margin: align === "center" ? "0 auto" : undefined,
      }}
    >
      {eyebrow ? (
        <span
          style={{
            // 07 §3: no site público nada desce de 14 px, e `--fs-label` já é
            // 14 px por `[data-app="web"]`. O sobretítulo distingue-se pelo
            // peso, pelas maiúsculas e pela cor de acento — não por ser menor.
            fontSize: "var(--fs-label)",
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--accent)",
          }}
        >
          {eyebrow}
        </span>
      ) : null}
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          // 22 → 40 px, dentro da escala de 04 §1.3.
          fontSize: "clamp(1.4rem, 3.4vw, 2.5rem)",
          lineHeight: 1.15,
          color: "var(--text)",
        }}
      >
        {title}
      </h2>
      {body ? (
        <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.6, color: "var(--muted)" }}>
          {body}
        </p>
      ) : null}
    </header>
  );
}
