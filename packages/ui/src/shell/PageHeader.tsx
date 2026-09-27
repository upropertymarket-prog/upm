import { cx } from "../lib/cx";

export type PageHeaderProps = {
  /** No Painel é a saudação ("Boa tarde, Ana"); nas restantes, o título. */
  title: string;
  subtitle?: string;
  /** Exportar + ação primária contextual, à direita (04 §5.5). */
  actions?: React.ReactNode;
  className?: string;
};

/**
 * PageHeader — 04 §5.5
 * =========================================================================
 * `<h1>` em Bricolage Grotesque, `clamp(24px, 3vw, 32px)` como nos protótipos —
 * dentro do intervalo de títulos de 07 §3 (22–56 px).
 *
 * A saudação em si ("Bom dia / Boa tarde / Boa noite") é calculada por quem usa
 * este componente: depende da hora e do primeiro nome, e a hora é estado, não
 * apresentação.
 *
 * O canvas deste componente está em tempo/designs/design-system/app-shell/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cx("upm-pagehead", className)}>
      <div className="upm-pagehead__text">
        <h1 className="upm-pagehead__title">{title}</h1>
        {subtitle ? <span className="upm-pagehead__subtitle">{subtitle}</span> : null}
      </div>
      {actions ? <div className="upm-pagehead__actions">{actions}</div> : null}
    </div>
  );
}

/** "Bom dia" < 13 h · "Boa tarde" < 20 h · "Boa noite" — protótipos. */
export function greetingKey(date = new Date()): "morning" | "afternoon" | "evening" {
  const hour = date.getHours();
  if (hour < 13) return "morning";
  if (hour < 20) return "afternoon";
  return "evening";
}
