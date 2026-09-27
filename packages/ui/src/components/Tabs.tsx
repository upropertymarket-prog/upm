"use client";

import { useRef } from "react";

import { cx } from "../lib/cx";
import { STATUS_TONES, type StatusTone } from "./StatusTag";

export type TabItem = {
  id: string;
  label: string;
  /** Contador ao lado da etiqueta (tabs do Suporte, 04 §8.6). */
  count?: number;
  /** Pinta o contador com a cor do estado que a tab representa (04 §5.6). */
  countTone?: StatusTone;
  icon?: React.ReactNode;
  disabled?: boolean;
};

export type TabsProps = {
  /** Nome do grupo, para leitores de ecrã. */
  label: string;
  items: TabItem[];
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
};

/**
 * Tabs — 04 §5.6 · 04 §5.7
 * =========================================================================
 * `role="tablist"` com navegação por setas, `Home`/`End` e roving tabindex: só
 * a tab ativa entra na ordem de `Tab`, e as setas movem entre tabs. É o padrão
 * ARIA e é o que 04 §5.7 exige ("navegação por teclado em menus").
 *
 * Não renderiza painéis — as vistas do produto trocam de conteúdo por rota ou
 * por estado, não por um painel escondido. Ligue `aria-controls` do lado de
 * quem usa quando houver um painel real.
 *
 * O canvas deste componente está em tempo/designs/design-system/navegacao/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function Tabs({ label, items, value, onValueChange, className }: TabsProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  function focusTab(index: number) {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("[role='tab']");
    buttons?.[index]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const enabled = items.map((item, index) => ({ item, index })).filter((e) => !e.item.disabled);
    if (enabled.length === 0) return;

    const current = enabled.findIndex((e) => e.item.id === value);
    let next: number;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (current + 1) % enabled.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (current - 1 + enabled.length) % enabled.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = enabled.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const target = enabled[next]!;
    onValueChange(target.item.id);
    focusTab(target.index);
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={cx("upm-tabs", className)}
      onKeyDown={onKeyDown}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className="upm-tab"
            onClick={() => onValueChange(item.id)}
          >
            {item.icon}
            {item.label}
            {typeof item.count === "number" ? (
              <span
                className="upm-tab__count"
                style={
                  item.countTone
                    ? { ["--tab-count-color" as string]: STATUS_TONES[item.countTone] }
                    : undefined
                }
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
