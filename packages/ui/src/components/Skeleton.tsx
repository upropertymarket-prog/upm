import { Children } from "react";

import { Brand } from "../shell/Brand";

/**
 * Skeleton — o ecrã novo antes de ter dados (19 nov 2026)
 * =========================================================================
 * Pedido do cliente: ao mudar de página, a app ficava parada na página antiga
 * até a nova vir inteira do servidor, e isso lia-se como lentidão. O ecrã tem
 * de mudar **logo** — para um esqueleto com a forma do que vem — e só depois
 * encher.
 *
 * As peças daqui compõem-se nos `loading.tsx` de cada rota, e cada rota monta
 * o esqueleto do seu ecrã: cabeçalho, filtros, tabela, cartões. Um esqueleto
 * genérico igual para tudo não serve, porque o salto do esqueleto para o
 * conteúdo é ele próprio um sinal de lentidão.
 *
 * Nenhuma peça tem estado nem hooks: os `loading.tsx` são componentes de
 * servidor e têm de as poder desenhar sem mais nada.
 */

type Size = number | string;

const px = (value: Size | undefined) => (typeof value === "number" ? `${value}px` : value);

export type SkeletonProps = {
  width?: Size;
  height?: Size;
  radius?: Size;
  className?: string;
  style?: React.CSSProperties;
};

/** Um bloco cinzento a pulsar. A unidade de tudo o resto. */
export function Skeleton({ width = "100%", height = 14, radius, className, style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={className ? `upm-skel ${className}` : "upm-skel"}
      style={{ width: px(width), height: px(height), borderRadius: px(radius), ...style }}
    />
  );
}

/**
 * O invólucro de um ecrã a carregar: anuncia-o ao leitor de ecrã uma vez, e o
 * resto fica escondido dele (`aria-hidden` em cada bloco).
 */
export function SkeletonPage({
  label,
  gap = "var(--sp-6)",
  fill = false,
  children,
}: {
  /** "A carregar…" — `common.loading`, traduzido por quem usa. */
  label: string;
  gap?: string;
  /** Ocupa a altura que o shell dá (ecrãs `fill`: correio, mensagens). */
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
        minWidth: 0,
        flex: fill ? 1 : undefined,
        minHeight: fill ? 0 : undefined,
      }}
    >
      <span className="upm-sr-only">{label}</span>
      {children}
    </div>
  );
}

/**
 * Cabeçalho de página. `divider` é o `PageHeader` do design system (com traço
 * por baixo); sem ele, é o `<header>` com `<h1>` simples que vários ecrãs usam.
 */
export function SkeletonHeader({
  subtitle = true,
  actions = 0,
  divider = false,
}: {
  subtitle?: boolean;
  actions?: number;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: "var(--sp-6)",
        paddingBottom: divider ? "var(--sp-7)" : undefined,
        borderBottom: divider ? "1px solid var(--border)" : undefined,
      }}
    >
      <div style={{ display: "grid", gap: "var(--sp-3)", flex: "1 1 16rem", minWidth: 0 }}>
        <Skeleton width="min(100%, 15rem)" height={28} radius="var(--r-lg)" />
        {subtitle ? <Skeleton width="min(100%, 26rem)" height={14} /> : null}
      </div>
      {actions > 0 ? (
        <div style={{ display: "flex", gap: "var(--sp-4)", flexWrap: "wrap" }}>
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton
              key={i}
              width={i === actions - 1 ? 132 : 108}
              height="var(--h-sm)"
              radius="var(--r-lg)"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Uma linha de cartões de KPI (Painel, Tráfego, Métricas). */
export function SkeletonStats({ count = 4, min = 200 }: { count?: number; min?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--sp-6)",
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="upm-card upm-card--pad" style={{ gap: "var(--sp-5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
            <Skeleton width={18} height={18} radius="var(--r-md)" />
            <Skeleton width="55%" height={12} />
          </div>
          <Skeleton width="40%" height={30} radius="var(--r-lg)" />
          <Skeleton width="70%" height={12} />
        </div>
      ))}
    </div>
  );
}

/** Um campo de formulário: rótulo por cima, caixa por baixo. */
export function SkeletonField({ grow = 1, area = false }: { grow?: number; area?: boolean }) {
  return (
    <div style={{ display: "grid", gap: "var(--sp-3)", flex: `${grow} 1 8.5rem`, minWidth: 0 }}>
      <Skeleton width="45%" height={12} />
      <Skeleton height={area ? 112 : "var(--h-sm)"} radius="var(--r-lg)" />
    </div>
  );
}

/** A barra de filtros: pesquisa mais larga, selects, botão no fim. */
export function SkeletonFilters({
  fields = 4,
  button = true,
  card = true,
}: {
  fields?: number;
  button?: boolean;
  card?: boolean;
}) {
  const row = (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--sp-5)" }}>
      {Array.from({ length: fields }, (_, i) => (
        <SkeletonField key={i} grow={i === 0 ? 2 : 1} />
      ))}
      {button ? <Skeleton width={104} height="var(--h-sm)" radius="var(--r-lg)" /> : null}
    </div>
  );
  return card ? <div className="upm-card upm-card--pad">{row}</div> : row;
}

/** Separadores (Tabs). */
export function SkeletonTabs({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} width={96} height="var(--h-sm)" radius="var(--r-lg)" />
      ))}
    </div>
  );
}

const CELL_WIDTHS = ["72%", "54%", "64%", "40%", "58%", "46%", "36%"];

/**
 * Tabela com cabeçalho e linhas. `card` envolve-a num cartão com padding (como
 * os ecrãs que põem tabela + paginação dentro de `<Card padded>`); sem ele é a
 * `upm-table-wrap` sozinha.
 */
export function SkeletonTable({
  rows = 8,
  columns = 5,
  pagination = false,
  card = true,
}: {
  rows?: number;
  columns?: number;
  pagination?: boolean;
  card?: boolean;
}) {
  const table = (
    <div className="upm-table-wrap" aria-hidden="true">
      <table className="upm-table">
        <thead>
          <tr>
            {Array.from({ length: columns }, (_, c) => (
              <th key={c}>
                <Skeleton width={c === 0 ? 96 : 64} height={10} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <td key={c}>
                  <Skeleton
                    width={CELL_WIDTHS[(r + c * 3) % CELL_WIDTHS.length]}
                    height={c === 0 ? 14 : 12}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const pager = pagination ? (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--sp-5)",
      }}
    >
      <Skeleton width={140} height={12} />
      <div style={{ display: "flex", gap: "var(--sp-3)" }}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton
            key={i}
            width={i === 0 || i === 3 ? 84 : 36}
            height="var(--h-sm)"
            radius="var(--r-lg)"
          />
        ))}
      </div>
    </div>
  ) : null;
  if (!card) {
    return pager ? (
      <div style={{ display: "grid", gap: "var(--sp-6)" }}>
        {table}
        {pager}
      </div>
    ) : (
      table
    );
  }
  return (
    <div className="upm-card upm-card--pad">
      {table}
      {pager}
    </div>
  );
}

/** Cartão com título e umas linhas de texto. */
export function SkeletonCard({
  lines = 3,
  height,
  title = true,
}: {
  lines?: number;
  /** Altura de um bloco grande (gráfico, pré-visualização) por baixo do título. */
  height?: Size;
  title?: boolean;
}) {
  return (
    <div className="upm-card upm-card--pad">
      {title ? <Skeleton width="40%" height={18} radius="var(--r-md)" /> : null}
      {height !== undefined ? <Skeleton height={height} radius="var(--r-xl)" /> : null}
      {lines > 0 ? (
        <div style={{ display: "grid", gap: "var(--sp-4)" }}>
          {Array.from({ length: lines }, (_, i) => (
            <Skeleton key={i} width={CELL_WIDTHS[i % CELL_WIDTHS.length]} height={12} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Grelha de cartões (modelos, planos, imóveis). */
export function SkeletonCards({
  count = 6,
  min = 320,
  lines = 3,
  height,
}: {
  count?: number;
  min?: number;
  lines?: number;
  height?: Size;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--sp-6)",
        gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${min}px), 1fr))`,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} lines={lines} height={height} />
      ))}
    </div>
  );
}

/** Formulário num cartão: título e campos, em uma ou duas colunas. */
export function SkeletonForm({
  fields = 4,
  columns = 1,
  title = true,
  area = false,
  submit = true,
}: {
  fields?: number;
  columns?: 1 | 2;
  title?: boolean;
  /** O último campo é uma área de texto. */
  area?: boolean;
  submit?: boolean;
}) {
  return (
    <div className="upm-card upm-card--pad">
      {title ? <Skeleton width="35%" height={18} radius="var(--r-md)" /> : null}
      <div
        style={{
          display: "grid",
          gap: "var(--sp-6)",
          gridTemplateColumns:
            columns === 2 ? "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" : "minmax(0, 1fr)",
        }}
      >
        {Array.from({ length: fields }, (_, i) => (
          <SkeletonField key={i} area={area && i === fields - 1} />
        ))}
      </div>
      {submit ? <Skeleton width={120} height="var(--h-sm)" radius="var(--r-lg)" /> : null}
    </div>
  );
}

/** Uma lista de linhas (avatar/ícone + duas linhas de texto). */
export function SkeletonList({ rows = 6, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div style={{ display: "grid", gap: "var(--sp-6)" }}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{ display: "flex", alignItems: "center", gap: "var(--sp-5)", minWidth: 0 }}
        >
          {avatar ? (
            <Skeleton width={36} height={36} radius="999px" style={{ flex: "none" }} />
          ) : null}
          <div style={{ display: "grid", gap: "var(--sp-3)", flex: 1, minWidth: 0 }}>
            <Skeleton width={CELL_WIDTHS[i % CELL_WIDTHS.length]} height={13} />
            <Skeleton width={CELL_WIDTHS[(i + 3) % CELL_WIDTHS.length]} height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Painéis lado a lado que ocupam a altura do ecrã — o cliente de correio
 * (pastas · lista · leitura) e as Mensagens (conversas · conversa). Cada
 * coluna é `[flex-basis, tipo]`; abaixo da largura mínima empilham-se.
 *
 * `separate`: cada painel é um cartão seu, com espaço entre eles (as
 * Mensagens); sem ele, é um cartão só com traços a dividir (o correio).
 */
export function SkeletonSplit({
  panes,
  minHeight = 520,
  separate = false,
}: {
  panes: Array<{ basis: string; kind: "rail" | "list" | "reader" }>;
  minHeight?: number;
  separate?: boolean;
}) {
  return (
    <div
      className={separate ? undefined : "upm-card"}
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: separate ? "var(--sp-6)" : undefined,
        flex: 1,
        minHeight,
        overflow: "hidden",
      }}
    >
      {panes.map((pane, i) => (
        <div
          key={i}
          className={separate ? "upm-card" : undefined}
          style={{
            flex: pane.kind === "reader" ? `1 1 ${pane.basis}` : `0 1 ${pane.basis}`,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-6)",
            padding: "var(--sp-7)",
            borderRight: !separate && i < panes.length - 1 ? "1px solid var(--border)" : undefined,
          }}
        >
          {pane.kind === "rail" ? (
            <>
              <Skeleton height="var(--h-sm)" radius="var(--r-lg)" />
              {Array.from({ length: 6 }, (_, r) => (
                <Skeleton key={r} width={CELL_WIDTHS[r % CELL_WIDTHS.length]} height={14} />
              ))}
            </>
          ) : pane.kind === "list" ? (
            <>
              <Skeleton height="var(--h-sm)" radius="var(--r-lg)" />
              <SkeletonList rows={7} />
            </>
          ) : (
            <>
              <div style={{ display: "grid", gap: "var(--sp-3)" }}>
                <Skeleton width="50%" height={20} radius="var(--r-md)" />
                <Skeleton width="30%" height={12} />
              </div>
              <div style={{ display: "grid", gap: "var(--sp-4)" }}>
                {Array.from({ length: 6 }, (_, r) => (
                  <Skeleton key={r} width={CELL_WIDTHS[r % CELL_WIDTHS.length]} height={12} />
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Colunas lado a lado que se empilham num ecrã estreito. Por omissão são
 * iguais; `basis` dá a cada coluna a sua largura de partida (`"248px"`,
 * `"60%"`) e a que tiver `"auto"` fica com o resto — a Cloud (pastas · lista),
 * as Campanhas (editor · lateral).
 */
export function SkeletonColumns({
  min = 320,
  basis,
  children,
}: {
  min?: number;
  basis?: string[];
  children: React.ReactNode;
}) {
  if (basis) {
    const items = Children.toArray(children);
    return (
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-6)", alignItems: "flex-start" }}
      >
        {items.map((child, i) => {
          const b = basis[i] ?? "auto";
          return (
            <div
              key={i}
              style={{
                // Peso 1000 contra 1: lado a lado, a coluna fixa quase não cresce; sozinha
                // numa linha (ecrã estreito), fica com a largura toda.
                flex: b === "auto" ? `1000 1 ${min}px` : `1 1 ${b}`,
                minWidth: `min(100%, ${b === "auto" ? min : 240}px)`,
                display: "grid",
              }}
            >
              {child}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--sp-6)",
        alignItems: "start",
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * O shell sem dados — só para a **primeira** carga de uma sessão no browser.
 * =========================================================================
 * Numa navegação dentro da app, o `loading.tsx` desenha o shell verdadeiro
 * (com o menu e o nome de quem está) a partir do que a página anterior deixou
 * em memória. Na primeira carga não há página anterior, e o servidor não sabe
 * — sem uma ida à base, que é precisamente o que se está a evitar — que menu
 * mostrar. Daí este: as mesmas classes e medidas do `<AppShell>`, sem texto.
 */
export function ShellSkeleton({
  fill = false,
  children,
}: {
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="upm-shell"
      data-collapsed="false"
      data-mobile-open="false"
      data-content="default"
      data-fill={fill ? "true" : "false"}
    >
      <aside className="upm-sidebar" aria-hidden="true" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="upm-sidebar__brand">
            <Brand />
          </div>
          <div style={{ padding: "0 var(--sp-4) var(--sp-4)" }}>
            <Skeleton width={72} height={10} />
          </div>
          <div className="upm-nav">
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--sp-5)",
                  height: "var(--h-sm)",
                  padding: "0 var(--sp-5)",
                }}
              >
                <Skeleton width={17} height={17} radius="var(--r-md)" style={{ flex: "none" }} />
                <Skeleton width={CELL_WIDTHS[i % CELL_WIDTHS.length]} height={12} />
              </div>
            ))}
          </div>
        </div>
        <div className="upm-sidebar__footer">
          <div className="upm-usercard">
            <Skeleton width={36} height={36} radius="999px" style={{ flex: "none" }} />
            <div style={{ display: "grid", gap: "var(--sp-3)", flex: 1, minWidth: 0 }}>
              <Skeleton width="70%" height={12} />
              <Skeleton width="50%" height={10} />
            </div>
          </div>
        </div>
      </aside>
      <div className="upm-shell__gutter" aria-hidden="true" />
      <div className="upm-shell__main">
        <header className="upm-topbar" aria-hidden="true">
          <div className="upm-topbar__inner">
            <Skeleton
              height="var(--h-sm)"
              radius="var(--r-lg)"
              style={{ flex: "1 1 220px", maxWidth: 380 }}
            />
            <div className="upm-topbar__actions">
              <Skeleton width={84} height="var(--h-sm)" radius="var(--r-lg)" />
              <Skeleton width={36} height="var(--h-sm)" radius="var(--r-lg)" />
            </div>
          </div>
        </header>
        <main className="upm-shell__content">{children}</main>
      </div>
    </div>
  );
}
