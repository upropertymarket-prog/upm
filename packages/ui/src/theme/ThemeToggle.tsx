"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { cx } from "../lib/cx";
import { useClickOutside } from "../lib/useDismissable";
import { Button } from "../components/Button";
import { THEME_CHOICES, type ResolvedTheme, type ThemeChoice } from "./theme";
import { useTheme } from "./ThemeProvider";
import { useState } from "react";

const ICON: Record<ThemeChoice, React.ComponentType<{ size?: number }>> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/** O segmentado da topbar não oferece "Sistema" — ver a nota no componente. */
const SEGMENTED_CHOICES = ["light", "dark"] as const satisfies readonly ResolvedTheme[];

/** O segmentado é mais baixo do que o botão da topbar e pede ícone menor. */
function icon(choice: ThemeChoice, size = 17) {
  const Glyph = ICON[choice];
  return <Glyph size={size} />;
}

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
 * Na topbar é um controlo segmentado (`variant="segmented"`) com **duas**
 * opções, Claro e Escuro: é a troca do dia a dia e tem de estar a um clique.
 * "Sistema" fica em Definições › Aparência, onde o `variant="inline"` mostra as
 * três — é lá que a escolha volta atrás. O `variant="menu"` continua disponível
 * para onde a largura não chegar para rótulos.
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
  variant?: "menu" | "inline" | "segmented";
  labels?: ThemeToggleLabels;
  className?: string;
}) {
  const { choice, resolved, setChoice } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));

  const text: Record<ThemeChoice, string> = {
    light: labels.light,
    dark: labels.dark,
    system: labels.system,
  };

  if (variant === "segmented") {
    // Só Claro e Escuro: "Sistema" continua a existir, em Definições ›
    // Aparência, que é onde 04 §5.2 pede que a escolha seja reversível. Com
    // `system` escolhido marca-se o tema que está mesmo aplicado — um
    // segmentado sem nenhuma opção ativa não diria nada ao utilizador.
    const active: ResolvedTheme = choice === "system" ? resolved : choice;

    return (
      <div
        className={cx("upm-segmented", className)}
        role="radiogroup"
        aria-label={labels.title}
        data-testid="upm-theme-segmented"
      >
        {SEGMENTED_CHOICES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active === option}
            className="upm-segmented__option"
            onClick={() => setChoice(option)}
          >
            {icon(option, 15)}
            {text[option]}
          </button>
        ))}
      </div>
    );
  }

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
            {icon(option)}
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
        {icon(choice)}
      </Button>
      {open ? (
        <div
          className="upm-menu__panel upm-menu__panel--compact"
          role="menu"
          aria-label={labels.title}
        >
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
              {icon(option)}
              {text[option]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
