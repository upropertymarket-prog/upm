"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  THEME_ATTR,
  THEME_CHOICE_ATTR,
  THEME_STORAGE_KEY,
  isThemeChoice,
  type ResolvedTheme,
  type ThemeChoice,
} from "./theme";

type ThemeContextValue = {
  /** O que o utilizador escolheu — pode ser `system`. */
  choice: ThemeChoice;
  /** O que está aplicado agora: `light` ou `dark`. */
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function prefersDark(): boolean {
  return typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  if (choice === "system") return prefersDark() ? "dark" : "light";
  return choice;
}

/**
 * Estado do tema no cliente (04 §5.2 · P1-03)
 * =========================================================================
 * O `ThemeScript` já pintou o `data-theme` correto antes deste provider
 * existir; o provider limita-se a assumir o que está no DOM e a manter o
 * atributo sincronizado com as mudanças posteriores. Por isso o estado inicial
 * vem de `initialChoice` (o mesmo valor que o script usou) e nunca de uma
 * leitura de `localStorage` no render — isso causaria mismatch de hidratação.
 *
 * A persistência em `profiles.theme` **não** é feita aqui: `packages/ui` não
 * fala com a base de dados (02 §3.3 — nada de lógica de negócio na UI). A app
 * injeta a Server Action em `persist`.
 */
export function ThemeProvider({
  children,
  initialChoice = "system",
  persist,
}: {
  children: React.ReactNode;
  /** Mesmo valor que o `ThemeScript` recebeu: `profiles.theme` ou `system`. */
  initialChoice?: ThemeChoice;
  /** Server Action que grava em `profiles.theme`. Ausente = sem sessão. */
  persist?: (choice: ThemeChoice) => void | Promise<void>;
}) {
  const [choice, setChoiceState] = useState<ThemeChoice>(initialChoice);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    initialChoice === "system" ? "light" : initialChoice,
  );

  // Primeira passagem no cliente: alinhar com o que o script anti-flash pôs no
  // DOM (que já teve acesso ao `prefers-color-scheme` real) e adotar a escolha
  // guardada no dispositivo quando o servidor não trouxe nenhuma.
  useEffect(() => {
    const root = document.documentElement;
    const domChoice = root.getAttribute(THEME_CHOICE_ATTR);
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Modo privado ou storage bloqueado: o tema funciona, só não persiste.
    }
    const next =
      initialChoice !== "system"
        ? initialChoice
        : isThemeChoice(domChoice)
          ? domChoice
          : isThemeChoice(stored)
            ? stored
            : initialChoice;
    setChoiceState(next);
    setResolved(resolve(next));
  }, [initialChoice]);

  // `system` tem de reagir ao utilizador trocar o tema do sistema operativo
  // com a app aberta — sem isto, "Sistema" significa "o sistema quando abri".
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTR, resolved);
    root.setAttribute(THEME_CHOICE_ATTR, choice);
  }, [choice, resolved]);

  const setChoice = useCallback(
    (next: ThemeChoice) => {
      setChoiceState(next);
      setResolved(resolve(next));
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // idem
      }
      // Falhar a gravar na conta não deve desfazer a escolha no ecrã: o tema é
      // uma preferência, não uma transação.
      void persist?.(next);
    },
    [persist],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ choice, resolved, setChoice }),
    [choice, resolved, setChoice],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme tem de ser usado dentro de <ThemeProvider>.");
  return ctx;
}

export function useOptionalTheme(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
