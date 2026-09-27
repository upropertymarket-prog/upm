/**
 * Narração partilhada pelos canvases do design system
 * =========================================================================
 * NÃO é código de produto e nunca é importado pelas apps: é a moldura que mostra
 * cada componente em claro e escuro lado a lado, que é o critério de aceitação
 * de P1-04 ("todos com hover/focus/disabled e modo escuro").
 *
 * Vive fora de `design-system/` de propósito: não é um canvas, é um módulo
 * auxiliar, e uma pasta sem `index.canvas.tsx` não é lida como canvas. Ficar
 * aqui evita seis cópias do mesmo invólucro.
 *
 * Desenhado só com tokens — o canvas não pode inventar cores que o produto não
 * tem (04 §5.2).
 */

export function Panel({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  return (
    <div
      data-theme={theme}
      style={{
        flex: 1,
        minWidth: 0,
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--fs-body)",
        padding: "var(--sp-8)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-7)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-label)",
          letterSpacing: "var(--ls-label)",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {theme === "light" ? "Claro" : "Escuro"}
      </span>
      {children}
    </div>
  );
}

/** Mesmo conteúdo, dois temas. A comparação é o ponto. */
export function ThemePair({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minWidth: 0 }}>
      <Panel theme="light">{children}</Panel>
      <Panel theme="dark">{children}</Panel>
    </div>
  );
}

/** Um grupo de exemplos com um rótulo por cima. */
export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", minWidth: 0 }}>
      <span
        style={{
          fontSize: "var(--fs-label)",
          fontWeight: "var(--fw-black)",
          letterSpacing: "var(--ls-label)",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "var(--sp-4)",
          minWidth: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Uma nota curta a explicar uma decisão. Prosa sobre o design, não produto. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: "var(--fs-label)",
        lineHeight: "var(--lh-normal)",
        color: "var(--muted)",
        maxWidth: "62ch",
      }}
    >
      {children}
    </p>
  );
}
