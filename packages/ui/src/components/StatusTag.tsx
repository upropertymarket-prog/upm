import { cx } from "../lib/cx";

/**
 * Tons de estado — 04 §5.6
 * =========================================================================
 * Cada tom é um token `--state-*` de `tokens.css`. Nenhum componente escreve
 * uma cor: escolhe um significado. A regra de 04 §5.6 — "cores nunca repetidas
 * para significados diferentes" — é uma propriedade desta tabela, não de quem
 * a usa, e é verificada em `StatusTag.test.ts`.
 */
export const STATUS_TONES = {
  // Visitas (07 §5.6)
  visitPending: "var(--state-visit-pending)",
  visitAccepted: "var(--state-visit-accepted)",
  visitRescheduled: "var(--state-visit-rescheduled)",
  visitCancelled: "var(--state-visit-cancelled)",
  visitCompleted: "var(--state-visit-completed)",
  visitArchived: "var(--state-visit-archived)",

  // Tickets (07 §5.11)
  ticketNew: "var(--state-ticket-new)",
  ticketTriage: "var(--state-ticket-triage)",
  ticketProgress: "var(--state-ticket-progress)",
  ticketAwaiting: "var(--state-ticket-awaiting)",
  ticketClosed: "var(--state-ticket-closed)",

  // Gravidade
  severityCritical: "var(--state-severity-critical)",
  severityHigh: "var(--state-severity-high)",
  severityMedium: "var(--state-severity-medium)",
  severityLow: "var(--state-severity-low)",

  // Negócio
  dealSale: "var(--state-deal-sale)",
  dealRent: "var(--state-deal-rent)",
  dealRented: "var(--state-deal-rented)",

  // Ciclo de vida genérico
  active: "var(--state-active)",
  pending: "var(--state-pending)",
  draft: "var(--state-draft)",
  archived: "var(--state-archived)",
  rejected: "var(--state-rejected)",
  new: "var(--state-new)",
} as const;

export type StatusTone = keyof typeof STATUS_TONES;

export type StatusTagProps = {
  tone: StatusTone;
  children: React.ReactNode;
  /** Ícone 13–14 px antes do texto (ex.: negócio com ícone, 04 §8.3). */
  icon?: React.ReactNode;
  className?: string;
};

/**
 * StatusTag — fundo sólido, texto `--on-solid`, sem contorno (04 §5.6).
 *
 * O canvas deste componente está em tempo/designs/design-system/dados/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function StatusTag({ tone, children, icon, className }: StatusTagProps) {
  return (
    <span
      className={cx("upm-tag", className)}
      style={{ ["--tag-bg" as string]: STATUS_TONES[tone], fontWeight: 600 }}
    >
      {icon}
      {children}
    </span>
  );
}

export type BadgeProps = {
  /** Contadores de navegação e de tabs (07 §4.2). */
  children: React.ReactNode;
  variant?: "accent" | "muted";
  className?: string;
  /** Texto para leitores de ecrã: "3" sozinho não diz nada. */
  srLabel?: string;
};

/**
 * Badge — contador. Laranja `--accent` por omissão, como os contadores de
 * Guardados, Mensagens, Meus pedidos e Contratos (07 §4.2).
 *
 * O canvas deste componente está em tempo/designs/design-system/dados/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function Badge({ children, variant = "accent", className, srLabel }: BadgeProps) {
  return (
    <span className={cx("upm-badge", variant === "muted" && "upm-badge--muted", className)}>
      {children}
      {srLabel ? <span className="upm-sr-only"> {srLabel}</span> : null}
    </span>
  );
}
