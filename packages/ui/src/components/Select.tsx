import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

import { cx } from "../lib/cx";
import { Field } from "./Field";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
  label: string;
  labelHidden?: boolean;
  hint?: string;
  error?: string;
  options: SelectOption[];
  /** Primeira opção vazia, para "sem escolha" explícita. */
  placeholder?: string;
  className?: string;
};

/**
 * Select — 04 §5.4
 * =========================================================================
 * `<select>` nativo, de propósito: em telemóvel dá o seletor do sistema, é
 * acessível sem código e não precisa de uma lista flutuante. O `appearance:
 * none` existe só para o chevron seguir `--muted` em vez da cor do SO — o
 * comportamento continua a ser o do browser.
 *
 * O canvas deste componente está em tempo/designs/design-system/formularios/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, labelHidden, hint, error, options, placeholder, className, disabled, ...rest },
  ref,
) {
  return (
    <Field label={label} labelHidden={labelHidden} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <div
          className={cx("upm-control", "upm-select")}
          data-invalid={invalid ? "true" : undefined}
          data-disabled={disabled ? "true" : undefined}
        >
          <select
            ref={ref}
            id={id}
            className={cx("upm-control__input", "upm-select__input")}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            disabled={disabled}
            {...rest}
          >
            {placeholder ? <option value="">{placeholder}</option> : null}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="upm-select__chevron" aria-hidden="true">
            <ChevronDown size={16} />
          </span>
        </div>
      )}
    </Field>
  );
});
