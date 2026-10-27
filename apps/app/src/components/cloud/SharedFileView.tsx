"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Download, FileText, Lock } from "lucide-react";
import { Button, Card, Input } from "@upm/ui";
import { formatBytes } from "@upm/db/cloud";
import { mimeLabel } from "@upm/cloud";

export type SharedLinkResult =
  | { error: string }
  | { needsCode: true }
  | {
      name: string;
      size: number;
      mime: string;
      permission: "view" | "download";
      url: string | null;
    };

export type SharedFileViewProps = {
  token: string;
  initial: SharedLinkResult;
  onSubmitCode: (token: string, code: string) => Promise<SharedLinkResult>;
};

/**
 * O que a pessoa de fora vê ao abrir a ligação (P6-02)
 * =========================================================================
 * Três estados e nada mais: pedir o código, mostrar o documento, ou dizer que a
 * ligação já não serve. Sem shell da app, sem navegação — quem chega aqui não
 * tem conta e não há para onde navegar.
 *
 * Não se diz nunca *porquê* a ligação falhou (expirou? foi revogada? o código
 * está errado ao fim de dez tentativas?). Distinguir os casos diria a quem
 * adivinha se vale a pena continuar.
 */
export function SharedFileView({ token, initial, onSubmitCode }: SharedFileViewProps) {
  const t = useTranslations("cloud");
  const [state, setState] = useState<SharedLinkResult>(initial);
  const [code, setCode] = useState("");
  const [wrong, setWrong] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setWrong(false);
    startTransition(async () => {
      const next = await onSubmitCode(token, code);
      if ("error" in next) {
        setWrong(true);
        return;
      }
      setState(next);
    });
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "var(--sp-7)",
        background: "var(--bg)",
      }}
    >
      <Card padded style={{ width: "min(420px, 100%)", display: "grid", gap: "var(--sp-6)" }}>
        {"error" in state ? (
          <>
            <strong style={{ fontSize: "var(--fs-title-sm)" }}>
              {t("sharedLink.unavailableTitle")}
            </strong>
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
              {t("sharedLink.unavailableBody")}
            </p>
          </>
        ) : "needsCode" in state ? (
          <>
            <span
              aria-hidden="true"
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--r-md)",
                background: "var(--accent-soft)",
                color: "var(--accent)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Lock size={20} />
            </span>
            <div style={{ display: "grid", gap: "var(--sp-3)" }}>
              <strong style={{ fontSize: "var(--fs-title-sm)" }}>
                {t("sharedLink.protectedTitle")}
              </strong>
              <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
                {t("sharedLink.protectedBody")}
              </p>
            </div>
            <Input
              label={t("sharedLink.codeLabel")}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
              inputMode="numeric"
              autoFocus
              error={wrong ? t("sharedLink.codeWrong") : undefined}
            />
            <Button fullWidth disabled={pending || code.length < 4} onClick={submit}>
              {t("sharedLink.open")}
            </Button>
          </>
        ) : (
          <>
            <span
              aria-hidden="true"
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--r-md)",
                background: "var(--surface2)",
                color: "var(--muted)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <FileText size={20} />
            </span>
            <div style={{ display: "grid", gap: "var(--sp-2)" }}>
              <strong style={{ fontSize: "var(--fs-title-sm)" }}>{state.name}</strong>
              <span style={{ color: "var(--muted)" }}>
                {mimeLabel(state.mime, t("fileFallback"))} · {formatBytes(state.size)}
              </span>
            </div>
            {state.url ? (
              <a
                href={state.url}
                className="upm-btn upm-btn--primary upm-btn--md upm-btn--full"
                style={{ textDecoration: "none" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download size={15} aria-hidden="true" />
                {state.permission === "download" ? t("transfer") : t("sharedLink.viewDocument")}
              </a>
            ) : (
              <p style={{ margin: 0, color: "var(--muted)" }}>{t("sharedLink.notAvailable")}</p>
            )}
          </>
        )}
      </Card>
    </main>
  );
}
