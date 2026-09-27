"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Comportamento de teclado e foco dos overlays — 04 §5.7
 * =========================================================================
 * WCAG 2.2 AA exige, em menus, modais e drawers: navegação por teclado, foco
 * visível, `Esc` a fechar e **focus trap** — o `Tab` não pode sair do painel
 * para a página por baixo, senão o utilizador de teclado "cai" para fora de um
 * diálogo que continua aberto.
 *
 * Faz três coisas, que andam sempre juntas e por isso vivem no mesmo hook:
 *  1. move o foco para o painel ao abrir e devolve-o ao elemento anterior ao
 *     fechar (senão o foco volta ao topo do documento);
 *  2. prende o `Tab`/`Shift+Tab` dentro do painel;
 *  3. fecha com `Esc` e bloqueia o scroll do `<body>` enquanto está aberto.
 */
export function useDismissable({
  open,
  onClose,
  trapFocus = true,
  lockScroll = true,
}: {
  open: boolean;
  onClose: () => void;
  trapFocus?: boolean;
  lockScroll?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const panel = ref.current;
    const previous = document.activeElement as HTMLElement | null;

    if (trapFocus && panel) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus({ preventScroll: true });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !trapFocus || !panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);

    const previousOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (lockScroll) document.body.style.overflow = previousOverflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, trapFocus, lockScroll]);

  return ref;
}

/** Fecha um painel leve (dropdown) ao clicar fora ou ao premir `Esc`. */
export function useClickOutside<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onCloseRef.current();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return ref;
}
