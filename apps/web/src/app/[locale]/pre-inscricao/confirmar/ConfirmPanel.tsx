"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, MailWarning } from "lucide-react";
import { Button } from "@upm/ui";
import { Link } from "@/i18n/navigation";

import type { ConfirmState } from "./confirmState";

/**
 * O painel de confirmação da pré-inscrição (P2-02)
 * =========================================================================
 * Três estados: por confirmar (um botão), confirmado e falhado. O botão existe
 * porque a confirmação é um POST e não um GET — a razão está em `actions.ts`.
 *
 * A action vem por prop, como no `PreRegistrationForm` e pelo mesmo motivo:
 * importá-la aqui tornava este componente irrenderizável no canvas.
 */
export type ConfirmPanelProps = {
  /** O token do link do e-mail. Vazio quando alguém chega à página sem ele. */
  token: string;
  onConfirm: (previous: ConfirmState, formData: FormData) => Promise<ConfirmState>;
  /**
   * O estado de partida. Só o canvas o passa (8 nov 2026): "Inscrição
   * confirmada" só aparece depois do clique, e uma storyboard não clica. A
   * página nunca o passa, e por isso começa sempre por confirmar.
   */
  initialState?: ConfirmState;
};

const PANEL: React.CSSProperties = {
  display: "grid",
  gap: "var(--sp-4)",
  justifyItems: "center",
  textAlign: "center",
  padding: "var(--sp-7) var(--sp-5)",
  borderRadius: "var(--r-lg)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  maxWidth: "32rem",
  margin: "0 auto",
};

const TITLE: React.CSSProperties = { margin: 0, fontSize: "18px", color: "var(--text)" };

const BODY: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  lineHeight: 1.6,
  color: "var(--muted)",
  maxWidth: "28rem",
};

export function ConfirmPanel({ token, onConfirm, initialState = {} }: ConfirmPanelProps) {
  const t = useTranslations("site.preRegistration.confirmPage");
  const [state, action, pending] = useActionState<ConfirmState, FormData>(onConfirm, initialState);

  if (state.ok) {
    return (
      <div role="status" style={PANEL}>
        <CheckCircle2 size={28} style={{ color: "var(--ok)" }} aria-hidden="true" />
        <h1 style={TITLE}>{t("okTitle")}</h1>
        <p style={BODY}>{t("okBody")}</p>
        <Link href="/" className="upm-btn upm-btn--secondary upm-btn--md">
          {t("back")}
        </Link>
      </div>
    );
  }

  // Sem token no URL o resultado é o mesmo de um token inválido, e de propósito:
  // quem chega aqui sem link não tem nada para confirmar, e dar-lhe um botão
  // que falha sempre era pior do que dizer-lhe logo.
  if (state.failed || token.length === 0) {
    return (
      <div role="status" style={PANEL}>
        <MailWarning size={28} style={{ color: "var(--warn)" }} aria-hidden="true" />
        <h1 style={TITLE}>{t("failTitle")}</h1>
        <p style={BODY}>{t("failBody")}</p>
        <Link href="/pre-inscricao" className="upm-btn upm-btn--primary upm-btn--md">
          {t("retry")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} style={PANEL}>
      <input type="hidden" name="token" value={token} />
      <h1 style={TITLE}>{t("title")}</h1>
      <p style={BODY}>{t("body")}</p>
      <Button type="submit" disabled={pending}>
        {pending ? t("confirming") : t("confirm")}
      </Button>
    </form>
  );
}
