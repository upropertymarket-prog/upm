import { forwardRef } from "react";

import { cx } from "../lib/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "upm-btn--primary",
  secondary: "upm-btn--secondary",
  ghost: "upm-btn--ghost",
  danger: "upm-btn--danger",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "upm-btn--sm",
  md: "upm-btn--md",
  lg: "upm-btn--lg",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ícone antes do texto (Lucide, 15–17 px). */
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /** Sem texto visível. Obriga a `aria-label` — o alvo continua 40 × 40 px. */
  iconOnly?: boolean;
  fullWidth?: boolean;
};

/**
 * Button — 04 §5.4
 * =========================================================================
 * Primário: fundo `--accent`, hover `--accent-hover`. Todos os botões têm
 * estado de hover, foco visível e desativado (04 §5.4 e §5.7).
 *
 * `type` é `"button"` por omissão de propósito: o `"submit"` implícito do HTML
 * é a causa clássica de um botão de ação dentro de um formulário submeter a
 * página sem ninguém pedir.
 *
 * O canvas deste componente está em tempo/designs/design-system/acoes/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    leadingIcon,
    trailingIcon,
    iconOnly = false,
    fullWidth = false,
    className,
    type = "button",
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "upm-btn",
        VARIANT[variant],
        iconOnly ? "upm-btn--icon" : SIZE[size],
        fullWidth && "upm-btn--full",
        className,
      )}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
});
