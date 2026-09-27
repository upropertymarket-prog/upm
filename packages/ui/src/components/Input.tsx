import { forwardRef } from "react";

import { cx } from "../lib/cx";
import { Field } from "./Field";

type NativeInput = Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "size">;

export type InputProps = NativeInput & {
  label: string;
  labelHidden?: boolean;
  hint?: string;
  error?: string;
  /** Ícone à esquerda dentro da moldura (protótipos: lupa na pesquisa). */
  leadingIcon?: React.ReactNode;
  trailingSlot?: React.ReactNode;
  className?: string;
};

/**
 * Input — 04 §5.4 · 04 §5.7
 * =========================================================================
 * A moldura, o foco e o estado de erro vivem no invólucro `.upm-control`; o
 * `<input>` é transparente por dentro. É assim que os protótipos fazem a
 * pesquisa com lupa, e permite ícones sem dois anéis de foco.
 *
 * O canvas deste componente está em tempo/designs/design-system/formularios/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, labelHidden, hint, error, leadingIcon, trailingSlot, className, disabled, ...rest },
  ref,
) {
  return (
    <Field label={label} labelHidden={labelHidden} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <div
          className="upm-control"
          data-invalid={invalid ? "true" : undefined}
          data-disabled={disabled ? "true" : undefined}
        >
          {leadingIcon ? <span className="upm-control__icon">{leadingIcon}</span> : null}
          <input
            ref={ref}
            id={id}
            className="upm-control__input"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            disabled={disabled}
            {...rest}
          />
          {trailingSlot}
        </div>
      )}
    </Field>
  );
});

export type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  label: string;
  labelHidden?: boolean;
  hint?: string;
  error?: string;
  className?: string;
};

/**
 * Textarea — 04 §5.4
 * =========================================================================
 * Mesma moldura e mesmas regras do `Input`, em várias linhas. Redimensiona só
 * na vertical: deixar redimensionar na horizontal parte o layout da coluna.
 *
 * O canvas deste componente está em tempo/designs/design-system/formularios/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, labelHidden, hint, error, className, disabled, rows = 4, ...rest },
  ref,
) {
  return (
    <Field label={label} labelHidden={labelHidden} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <div
          className={cx("upm-control", "upm-textarea")}
          data-invalid={invalid ? "true" : undefined}
          data-disabled={disabled ? "true" : undefined}
        >
          <textarea
            ref={ref}
            id={id}
            rows={rows}
            className={cx("upm-control__input", "upm-textarea__input")}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            disabled={disabled}
            {...rest}
          />
        </div>
      )}
    </Field>
  );
});
