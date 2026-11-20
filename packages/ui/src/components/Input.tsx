"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

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
  /** Rótulos do botão de mostrar/ocultar, que só aparece em `type="password"`. */
  revealLabels?: { show: string; hide: string };
  className?: string;
};

/**
 * Input — 04 §5.4 · 04 §5.7
 * =========================================================================
 * A moldura, o foco e o estado de erro vivem no invólucro `.upm-control`; o
 * `<input>` é transparente por dentro. É assim que os protótipos fazem a
 * pesquisa com lupa, e permite ícones sem dois anéis de foco.
 *
 * Um `type="password"` traz o botão de mostrar/ocultar (19 nov 2026): quem
 * escreve uma palavra-passe às cegas engana-se e só o descobre no "Credenciais
 * inválidas". Vale para todos os campos de segredo, PIN incluído.
 *
 * O canvas deste componente está em tempo/designs/design-system/formularios/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    labelHidden,
    hint,
    error,
    leadingIcon,
    trailingSlot,
    revealLabels = { show: "Mostrar", hide: "Ocultar" },
    className,
    disabled,
    type,
    ...rest
  },
  ref,
) {
  const [revealed, setRevealed] = useState(false);
  const isSecret = type === "password";

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
            type={isSecret && revealed ? "text" : type}
            {...rest}
          />
          {isSecret ? (
            <button
              type="button"
              className="upm-control__reveal"
              aria-label={revealed ? revealLabels.hide : revealLabels.show}
              aria-controls={id}
              aria-pressed={revealed}
              disabled={disabled}
              onClick={() => setRevealed((value) => !value)}
            >
              {revealed ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </button>
          ) : null}
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
