import { useId } from "react";

import { cx } from "../lib/cx";

export type FieldProps = {
  /** Obrigatório: 04 §5.7 exige label em todos os inputs. */
  label: string;
  /** Esconde o label visualmente, mantendo-o para leitores de ecrã. */
  labelHidden?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  /** Recebe os ids a ligar ao controlo. */
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
};

/**
 * Field — invólucro de label, ajuda e erro
 * =========================================================================
 * Existe para que nenhum input possa ser escrito sem label: o `label` é uma
 * prop obrigatória e os ids são gerados aqui, não à mão em cada ecrã
 * (04 §5.7). O erro liga-se por `aria-describedby` e `aria-invalid`.
 */
export function Field({ label, labelHidden, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("upm-field", className)}>
      <label className={cx("upm-field__label", labelHidden && "upm-sr-only")} htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <span className="upm-field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="upm-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
