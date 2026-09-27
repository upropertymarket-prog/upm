"use client";

import { useId } from "react";

import { cx } from "../lib/cx";

export type ToggleProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  /** Esconde o texto (uso em barras de ferramentas). Mantém-se para leitores. */
  labelHidden?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Toggle — interruptor (04 §5.4)
 * =========================================================================
 * `<button role="switch">` com `aria-checked`, que é o padrão ARIA para algo
 * que liga e desliga de imediato. Não é um checkbox: um checkbox espera pelo
 * "Guardar" do formulário, um switch aplica na hora — e os sítios onde o
 * produto usa isto (localização aproximada, feature flags, "Open Graph igual
 * aos dados da página") aplicam na hora.
 *
 * O desenho tem 44 × 24 px, mas o invólucro garante os 40 px de alvo
 * (07 §5.14) sem inflar a pintura.
 *
 * O canvas deste componente está em tempo/designs/design-system/formularios/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function Toggle({
  checked,
  onCheckedChange,
  label,
  hint,
  labelHidden = false,
  disabled = false,
  className,
}: ToggleProps) {
  const labelId = useId();
  const hintId = hint ? `${labelId}-hint` : undefined;

  return (
    <div className={cx("upm-toggle", className)} data-disabled={disabled ? "true" : undefined}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={hintId}
        disabled={disabled}
        className="upm-toggle__track"
        onClick={() => onCheckedChange(!checked)}
      >
        <span className="upm-toggle__knob" />
      </button>
      <span className={cx("upm-toggle__text", labelHidden && "upm-sr-only")}>
        <span className="upm-toggle__label" id={labelId}>
          {label}
        </span>
        {hint ? (
          <span className="upm-toggle__hint" id={hintId}>
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  );
}
