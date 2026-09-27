"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { cx } from "../lib/cx";
import { useClickOutside } from "../lib/useDismissable";
import { Button } from "../components/Button";
import { THEME_CHOICES, type ThemeChoice } from "./theme";
import { useTheme } from "./ThemeProvider";
import { useState } from "react";

const ICON: Record<ThemeChoice, React.ReactNode> = {
  light: <Sun size={17} />,
  dark: <Moon size={17} />,
  system: <Monitor size={17} />,
};

export type ThemeToggleLabels = {
  /** Nome do controlo, para leitores de ecrã. */
  title: string;
  light: string;
  dark: string;
  system: string;
};

const DEFAULT_LABELS: ThemeToggleLabels = {
  title: "Tema",
  light: "Claro",
  dark: "Escuro",
  system: "Sistema",
};

/**
 * ThemeToggle — Claro / Escuro / Sistema (04 §5.2 · 04 §5.5 · P1-03)
 * =========================================================================
 * Três opções e não duas: sem "Sistema" explícito não há como voltar a seguir o
 * sistema operativo depois de uma escolha manual.
 *
 * Na topbar é um botão com menu (o espaço é o que é); em Definições › Aparência
 * o mesmo componente rende-se em três botões lado a lado (`variant="inline"`),
 * porque aí a escolha é o conteúdo da secção.
 *
 * O ícone mostrado é o da **escolha**, não o do tema resolvido: com "Sistema"
 * selecionado tem de aparecer o monitor, senão o utilizador não distingue
 * "Sistema (escuro)" de "Escuro".
 *
 * O canvas deste componente está em tempo/designs/design-system/app-shell/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function ThemeToggle({
  variant = "menu",
  labels = DEFAULT_LABELS,
  className,
}: {
  variant?: "menu" | "inline";
  labels?: ThemeToggleLabels;
  className?: string;
}) {
  const { choice, setChoice } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));

  const text: Record<ThemeChoice, string> = {
    light: labels.light,
    dark: labels.dark,
    system: labels.system,
  };

  if (variant === "inline") {
    return (
      <div
        className={cx("upm-tabs", className)}
        role="radiogroup"
        aria-label={labels.title}
        data-testid="upm-theme-inline"
      >
        {THEME_CHOICES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={choice === option}
            aria-selected={choice === option}
            className="upm-tab"
            onClick={() => setChoice(option)}
          >
            {ICON[option]}
            {text[option]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cx("upm-menu", className)} ref={ref}>
      <Button
        variant="secondary"
        iconOnly
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${labels.title}: ${text[choice]}`}
        title={`${labels.title}: ${text[choice]}`}
        onClick={() => setOpen((value) => !value)}
      >
        {ICON[choice]}
      </Button>
      {open ? (
        <div className="upm-menu__panel" role="menu" aria-label={labels.title}>
          {THEME_CHOICES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={choice === option}
              className="upm-menu__item"
              onClick={() => {
                setChoice(option);
                setOpen(false);
              }}
            >
              {ICON[option]}
              {text[option]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
