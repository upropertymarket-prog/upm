"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown } from "lucide-react";

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

/** O `setter` nativo de `value`: escrever por ele é o que o React reconhece como mudança. */
const nativeValueSetter =
  typeof window !== "undefined"
    ? Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set
    : undefined;

/**
 * Select — 04 §5.4
 * =========================================================================
 * **Lista própria desde 11 nov 2026.** Até aqui era o `<select>` nativo com
 * `appearance: none`: a caixa seguia o design system, mas a lista que abre é
 * desenhada pelo sistema operativo — fundo branco em tema escuro, texto quase
 * invisível, nenhuma personalidade (cliente). A lista é agora nossa: superfície
 * do tema, opção ativa em `--surface2`, escolhida em laranja com ✓.
 *
 * **O `<select>` nativo continua lá, escondido**, e é ele que manda: tem o
 * `name`, o `value`/`defaultValue`, o `required`, o `ref` e o `onChange` de
 * sempre. Escolher na lista escreve no nativo e dispara um `change` real — por
 * isso os ~60 sítios que usam este componente (formulários com `FormData`,
 * filtros com `onChange`, `requestSubmit`) não mudam uma linha.
 *
 * Teclado (padrão "select-only combobox" do WAI-ARIA APG): ↑/↓, Home/End,
 * Enter/Espaço escolhem, Esc fecha, letras saltam para a opção, Tab sai.
 *
 * O canvas deste componente está em tempo/designs/design-system/formularios/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    labelHidden,
    hint,
    error,
    options,
    placeholder,
    className,
    disabled,
    value,
    defaultValue,
    ...rest
  },
  ref,
) {
  const native = useRef<HTMLSelectElement>(null);
  useImperativeHandle(ref, () => native.current as HTMLSelectElement);

  const all: SelectOption[] = placeholder
    ? [{ value: "", label: placeholder }, ...options]
    : options;
  const controlled = value !== undefined;
  const [inner, setInner] = useState<string>(() =>
    defaultValue !== undefined ? String(defaultValue) : (all[0]?.value ?? ""),
  );
  const current = controlled ? String(value) : inner;
  const selected = all.find((option) => option.value === current) ?? all[0];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [upward, setUpward] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();

  // O nativo pode mudar por fora: `reset` do formulário, ou o React a repor um
  // valor controlado. O que se mostra lê-se sempre dele.
  useEffect(() => {
    const select = native.current;
    if (!select) return;
    const sync = () => setInner(select.value);
    const form = select.form;
    const onReset = () => setTimeout(sync, 0);
    select.addEventListener("change", sync);
    form?.addEventListener("reset", onReset);
    return () => {
      select.removeEventListener("change", sync);
      form?.removeEventListener("reset", onReset);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);

  // Fecha ao tocar fora.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open, close]);

  // A opção ativa fica sempre à vista dentro da lista.
  useEffect(() => {
    if (!open || active < 0) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function choose(option: SelectOption) {
    const select = native.current;
    if (!select || option.disabled) return;
    if (option.value !== select.value) {
      nativeValueSetter?.call(select, option.value);
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close();
  }

  function openList() {
    if (disabled) return;
    // Abre para cima quando não há lugar por baixo (o fim da página, uma caixa).
    const box = root.current?.getBoundingClientRect();
    if (box) {
      const below = window.innerHeight - box.bottom;
      setUpward(below < 240 && box.top > below);
    }
    const index = all.findIndex((option) => option.value === current);
    setActive(index >= 0 ? index : firstEnabled(all, 0, 1));
    setOpen(true);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const key = event.key;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      const step = key === "ArrowDown" ? 1 : -1;
      setActive((index) => firstEnabled(all, index + step, step, index));
    } else if (key === "Home" || key === "End") {
      event.preventDefault();
      setActive(key === "Home" ? firstEnabled(all, 0, 1) : firstEnabled(all, all.length - 1, -1));
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      const option = all[active];
      if (option) choose(option);
    } else if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (key === "Tab") {
      close();
    } else if (key.length === 1 && /\S/.test(key)) {
      // Escrever salta para a primeira opção que começa pelo que se escreveu.
      const now = Date.now();
      const text = (now - typed.current.at < 700 ? typed.current.text : "") + key.toLowerCase();
      typed.current = { text, at: now };
      const index = all.findIndex(
        (option) => !option.disabled && option.label.toLowerCase().startsWith(text),
      );
      if (index >= 0) setActive(index);
    }
  }

  return (
    <Field label={label} labelHidden={labelHidden} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <div
          ref={root}
          className={cx("upm-control", "upm-select")}
          data-invalid={invalid ? "true" : undefined}
          data-disabled={disabled ? "true" : undefined}
          data-open={open ? "true" : undefined}
        >
          <button
            type="button"
            id={id}
            role="combobox"
            className={cx(
              "upm-control__input",
              "upm-select__input",
              selected?.value === "" && "upm-select__input--empty",
            )}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            disabled={disabled}
            onClick={() => (open ? close() : openList())}
            onKeyDown={onKeyDown}
            onBlur={(event) => {
              if (!root.current?.contains(event.relatedTarget as Node)) close();
            }}
          >
            <span className="upm-select__value">{selected?.label ?? ""}</span>
          </button>
          <span className="upm-select__chevron" aria-hidden="true">
            <ChevronDown size={16} />
          </span>

          {/* O nativo: guarda o valor, entra no `FormData` e dispara o
              `onChange`. Fora da ordem de tabulação e da árvore de
              acessibilidade — quem se anuncia é o botão acima. */}
          <select
            ref={native}
            className="upm-select__native"
            tabIndex={-1}
            aria-hidden="true"
            disabled={disabled}
            {...(controlled ? { value } : { defaultValue: defaultValue ?? inner })}
            {...rest}
          >
            {all.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>

          {open ? (
            <ul
              ref={list}
              id={listId}
              role="listbox"
              aria-labelledby={id}
              className="upm-select__list"
              data-placement={upward ? "top" : "bottom"}
            >
              {all.map((option, index) => {
                const isSelected = option.value === current;
                return (
                  <li
                    key={option.value}
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    className={cx(
                      "upm-select__option",
                      index === active && "upm-select__option--active",
                      option.value === "" && "upm-select__option--empty",
                    )}
                    // `mousedown` com `preventDefault`: o foco fica no botão,
                    // que é quem fala com o leitor de ecrã.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => !option.disabled && setActive(index)}
                    onClick={() => choose(option)}
                  >
                    <span className="upm-select__option-label">{option.label}</span>
                    {/* O valor vazio ("Selecione…") não é uma escolha: sem ✓. */}
                    {isSelected && option.value !== "" ? (
                      <Check size={15} aria-hidden="true" />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </Field>
  );
});

/** A próxima opção ativável a partir de `from`, no sentido `step`; fica onde estava se não houver. */
function firstEnabled(options: SelectOption[], from: number, step: number, fallback = -1): number {
  for (let index = from; index >= 0 && index < options.length; index += step) {
    if (!options[index]?.disabled) return index;
  }
  return fallback;
}
