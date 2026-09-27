"use client";

import { useEffect, useId, useRef } from "react";
import { Check, Minus } from "lucide-react";

import { cx } from "../lib/cx";

export type CheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "className" | "children"
> & {
  label: React.ReactNode;
  hint?: string;
  /** Terceiro estado, para "selecionar todos" parcial em tabelas. */
  indeterminate?: boolean;
  className?: string;
};

/**
 * Checkbox — 04 §5.4 · 04 §5.7
 * =========================================================================
 * `<input type="checkbox">` real, escondido por CSS e coberto por um quadrado
 * pintado. Assim mantém-se tudo o que o nativo dá de graça — teclado, leitores
 * de ecrã, `required`, participação no `FormData` — e continua a poder ser
 * usado dentro de um `<form>` com Server Action (02 §3.3).
 *
 * `indeterminate` só existe no DOM, não em HTML, logo escreve-se por `ref`.
 *
 * O canvas deste componente está em tempo/designs/design-system/formularios/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function Checkbox({
  label,
  hint,
  indeterminate = false,
  className,
  disabled,
  id: idProp,
  ...rest
}: CheckboxProps) {
  const generated = useId();
  const id = idProp ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label
      className={cx("upm-check", className)}
      htmlFor={id}
      data-disabled={disabled ? "true" : undefined}
    >
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="upm-check__input"
        aria-describedby={hintId}
        disabled={disabled}
        {...rest}
      />
      <span className="upm-check__box" aria-hidden="true">
        {indeterminate ? <Minus size={14} /> : <Check size={14} />}
      </span>
      <span className="upm-check__text">
        <span className="upm-check__label">{label}</span>
        {hint ? (
          <span className="upm-check__hint" id={hintId}>
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}
