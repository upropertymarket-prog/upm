/**
 * Narração de canvas — Fundações do design system (04 §5.1 · 07 §3 · 07 §5.14)
 * =========================================================================
 * Ficheiro local do canvas. NÃO é código de produto: é a documentação viva dos
 * tokens, desenhada só com tokens. Cada amostra lê a variable através de
 * `var(--…)`, logo o que está aqui é sempre o que está em `tokens.css` — não uma
 * cópia que possa ficar desatualizada.
 */

const PALETTE = [
  "--bg",
  "--surface",
  "--surface2",
  "--surface3",
  "--border",
  "--border2",
  "--text",
  "--muted",
  "--accent",
  "--accent-hover",
  "--accent-ink",
  "--accent-soft",
  "--ph1",
  "--ph2",
  "--ok",
  "--ok-soft",
  "--warn",
  "--warn-soft",
  "--danger",
  "--danger-soft",
  "--info",
  "--info-soft",
];

const STATES: [string, string][] = [
  ["Visita pendente", "--state-visit-pending"],
  ["Visita aceite", "--state-visit-accepted"],
  ["Visita reagendada", "--state-visit-rescheduled"],
  ["Visita cancelada", "--state-visit-cancelled"],
  ["Visita concluída", "--state-visit-completed"],
  ["Visita arquivada", "--state-visit-archived"],
  ["Ticket por tratar", "--state-ticket-new"],
  ["Ticket em curso", "--state-ticket-progress"],
  ["Ticket por confirmar", "--state-ticket-awaiting"],
  ["Ticket fechado", "--state-ticket-closed"],
  ["Gravidade crítica", "--state-severity-critical"],
  ["Gravidade alta", "--state-severity-high"],
  ["Gravidade média", "--state-severity-medium"],
  ["Gravidade baixa", "--state-severity-low"],
  ["Venda", "--state-deal-sale"],
  ["Arrendamento", "--state-deal-rent"],
  ["Arrendado", "--state-deal-rented"],
];

function Panel({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  return (
    <div
      data-theme={theme}
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        padding: "var(--sp-8)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-6)",
        minWidth: 0,
        flex: 1,
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

function Pair({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "row", minWidth: 0, fontFamily: "var(--font-sans)" }}>
      <Panel theme="light">{children}</Panel>
      <Panel theme="dark">{children}</Panel>
    </div>
  );
}

function Swatch({ token }: { token: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", minWidth: 0 }}>
      <span
        style={{
          width: 44,
          height: 44,
          flex: "none",
          borderRadius: "var(--r-md)",
          border: "1px solid var(--border2)",
          background: `var(${token})`,
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-label)",
          color: "var(--muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {token}
      </span>
    </div>
  );
}

/** 04 §5.1 — a paleta completa, nos dois temas, lado a lado. */
export function Cores() {
  return (
    <Pair>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: "var(--sp-5)",
        }}
      >
        {PALETTE.map((token) => (
          <Swatch key={token} token={token} />
        ))}
      </div>
    </Pair>
  );
}

/** 04 §5.6 — cores de estado: sólido + texto `--on-solid`, iguais nos dois temas. */
export function Estado() {
  return (
    <Pair>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)" }}>
        {STATES.map(([label, token]) => (
          <span
            key={token}
            style={{
              padding: "var(--sp-1) var(--sp-4)",
              borderRadius: "var(--r-pill)",
              background: `var(${token})`,
              color: "var(--on-solid)",
              fontSize: "var(--fs-label)",
              fontWeight: "var(--fw-black)",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </Pair>
  );
}

const TYPE_SCALE: [string, string, string][] = [
  ["--fs-title-lg", "var(--font-display)", "Títulos grandes · 32–56 px"],
  ["--fs-title", "var(--font-display)", "Título de página · 24–32 px"],
  ["--fs-title-sm", "var(--font-display)", "Título de secção · 22 px"],
  ["--fs-subtitle-lg", "var(--font-display)", "Subtítulo · 17 px"],
  ["--fs-subtitle", "var(--font-sans)", "Subtítulo · 15 px"],
  ["--fs-body-lg", "var(--font-sans)", "Texto · 14 px"],
  ["--fs-body", "var(--font-sans)", "Texto e UI · 13 px (mínimo na app)"],
  ["--fs-label", "var(--font-mono)", "Etiquetas, contadores e refs · 13 px"],
];

/** 07 §3 — a escala revista. Os níveis de 12 px e 12,5 px foram eliminados. */
export function Tipografia() {
  return (
    <Pair>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
        {TYPE_SCALE.map(([token, family, note]) => (
          <div key={token} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span
              style={{
                fontFamily: family,
                fontSize: `var(${token})`,
                fontWeight: "var(--fw-bold)",
                lineHeight: "var(--lh-tight)",
                letterSpacing: token.includes("title") ? "var(--ls-title)" : undefined,
              }}
            >
              Imóveis sem comissões
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-label)",
                color: "var(--muted)",
              }}
            >
              {token} · {note}
            </span>
          </div>
        ))}
      </div>
    </Pair>
  );
}

const RADII = ["--r-xs", "--r-sm", "--r-md", "--r-lg", "--r-xl", "--r-2xl", "--r-3xl", "--r-pill"];
const HEIGHTS = ["--h-xs", "--h-sm", "--h-md", "--h-lg", "--h-xl"];

/** Raios, alturas de controlo e o alvo de toque de 40 px (07 §5.14). */
export function Geometria() {
  return (
    <Pair>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-7)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-5)" }}>
          {RADII.map((token) => (
            <div key={token} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  width: 56,
                  height: 56,
                  background: "var(--surface2)",
                  border: "1px solid var(--border2)",
                  borderRadius: `var(${token})`,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-label)",
                  color: "var(--muted)",
                }}
              >
                {token}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--sp-5)" }}>
          {HEIGHTS.map((token) => (
            <div key={token} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  width: 96,
                  height: `var(${token})`,
                  background: "var(--surface2)",
                  border: "1px solid var(--border2)",
                  borderRadius: "var(--r-md)",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-label)",
                  color: "var(--muted)",
                }}
              >
                {token}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-5)" }}>
          <span
            style={{
              width: "var(--tap)",
              height: "var(--tap)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px dashed var(--accent)",
              borderRadius: "var(--r-xl)",
              color: "var(--accent)",
              fontSize: "var(--fs-label)",
              fontWeight: "var(--fw-black)",
            }}
          >
            40
          </span>
          <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
            `--tap` · alvo mínimo de toque, mesmo quando o ícone desenhado tem 14 px (07 §5.14)
          </span>
        </div>
      </div>
    </Pair>
  );
}
