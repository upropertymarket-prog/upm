"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cx } from "../lib/cx";

export type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  text: string;
  tone: ToastTone;
};

type ToastContextValue = {
  toast: (text: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** 2400 ms — a duração dos protótipos. */
const DURATION_MS = 2400;

const MARK: Record<ToastTone, React.ReactNode> = {
  success: <CheckCircle2 size={17} />,
  error: <AlertCircle size={17} />,
  info: <Info size={17} />,
};

/**
 * Toast — 04 §5.7
 * =========================================================================
 * A região é `aria-live="polite"` e `role="status"`: 04 §5.7 exige `aria-live`
 * nos toasts, porque um aviso que só aparece visualmente não existe para quem
 * usa leitor de ecrã.
 *
 * `polite` e não `assertive` de propósito — um toast confirma uma ação que o
 * utilizador acabou de fazer; interromper a leitura em curso seria pior. Erros
 * que exigem decisão são modal, não toast (04 §5.4).
 *
 * O canvas deste componente está em tempo/designs/design-system/sobreposicoes/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((text: string, tone: ToastTone = "info") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, text, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, DURATION_MS);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="upm-toasts" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((item) => (
          <div key={item.id} className={cx("upm-toast", `upm-toast--${item.tone}`)}>
            <span className="upm-toast__mark" aria-hidden="true">
              {MARK[item.tone]}
            </span>
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast tem de ser usado dentro de <ToastProvider>.");
  return ctx;
}
