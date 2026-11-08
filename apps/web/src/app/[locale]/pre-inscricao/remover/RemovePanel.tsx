"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, MailWarning, Trash2 } from "lucide-react";
import { Button } from "@upm/ui";
import { Link } from "@/i18n/navigation";

import type { RemoveState } from "./removeState";

/**
 * O painel de remoção da pré-inscrição (8 nov 2026)
 * =========================================================================
 * Três estados, como o da confirmação: por remover (um botão), removida e
 * falhada. O botão existe porque apagar é um POST — a razão está em
 * `actions.ts`. A action vem por prop, para o painel se poder desenhar no
 * canvas sem servidor.
 */
export type RemovePanelProps = {
  /** O token do link do e-mail. Vazio quando alguém chega à página sem ele. */
  token: string;
  onRemove: (previous: RemoveState, formData: FormData) => Promise<RemoveState>;
  /** O estado de partida — só o canvas o passa. */
  initialState?: RemoveState;
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

export function RemovePanel({ token, onRemove, initialState = {} }: RemovePanelProps) {
  const t = useTranslations("site.preRegistration.removePage");
  const [state, action, pending] = useActionState<RemoveState, FormData>(onRemove, initialState);

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

  if (state.failed || token.length === 0) {
    return (
      <div role="status" style={PANEL}>
        <MailWarning size={28} style={{ color: "var(--warn)" }} aria-hidden="true" />
        <h1 style={TITLE}>{t("failTitle")}</h1>
        <p style={BODY}>{t("failBody")}</p>
        <Link href="/" className="upm-btn upm-btn--secondary upm-btn--md">
          {t("back")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} style={PANEL}>
      <input type="hidden" name="token" value={token} />
      <h1 style={TITLE}>{t("title")}</h1>
      <p style={BODY}>{t("body")}</p>
      <Button type="submit" variant="danger" leadingIcon={<Trash2 size={16} />} disabled={pending}>
        {pending ? t("removing") : t("remove")}
      </Button>
    </form>
  );
}
