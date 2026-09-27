import { cx } from "../lib/cx";

export type EmptyStateProps = {
  /** Ícone Lucide a 40 px, cor `--muted` (protótipo de Guardados). */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Ação que resolve o vazio ("Explorar propriedades"). */
  action?: React.ReactNode;
  className?: string;
};

/**
 * EmptyState — 04 §8.4
 * =========================================================================
 * Um estado vazio sem saída é um beco: por isso `action` existe e deve ser
 * preenchida sempre que houver uma ação óbvia que tire o utilizador dali.
 *
 * O canvas deste componente está em tempo/designs/design-system/dados/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx("upm-empty", className)}>
      {icon ? (
        <span className="upm-empty__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <h3 className="upm-empty__title">{title}</h3>
      {description ? <p className="upm-empty__text">{description}</p> : null}
      {action}
    </div>
  );
}
