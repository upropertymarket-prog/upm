import { cx } from "../lib/cx";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Aplica o padding no próprio cartão (uso simples, sem header/body/footer). */
  padded?: boolean;
  /** Cartão clicável: hover, foco visível e semântica de botão. */
  interactive?: boolean;
};

/**
 * Card — 04 §5.4
 * =========================================================================
 * Superfície base de tudo o que é lista, KPI, formulário e estado vazio:
 * `--surface`, borda `--border`, raio 16 px (medido nos protótipos).
 *
 * Quando `interactive`, ganha `role="button"` e `tabIndex` — um cartão que se
 * clica tem de se poder ativar com o teclado (04 §5.7).
 *
 * O canvas deste componente está em tempo/designs/design-system/dados/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function Card({ padded = false, interactive = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        "upm-card",
        padded && "upm-card--pad",
        interactive && "upm-card--interactive",
        className,
      )}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      {...rest}
    />
  );
}

export function CardHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("upm-card__header", className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cx("upm-card__title", className)} {...rest} />;
}

export function CardBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("upm-card__body", className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("upm-card__footer", className)} {...rest} />;
}
