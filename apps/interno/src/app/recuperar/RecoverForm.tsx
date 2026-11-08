"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@upm/ui";

import type { RecoverState } from "./actions";

const initialState: RecoverState = {};

/**
 * A action vem por prop: importá-la aqui arrastava a chave de serviço para o
 * grafo do canvas (ver a memória "Server actions fora do grafo do canvas").
 */
export function RecoverForm({
  onSubmit,
}: {
  onSubmit: (previous: RecoverState, formData: FormData) => Promise<RecoverState>;
}) {
  const t = useTranslations("auth.staffRecovery");
  const [state, formAction, pending] = useActionState(onSubmit, initialState);

  if (state.sent) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <h1 className="text-lg font-semibold text-text">{t("sentTitle")}</h1>
        <p className="text-sm text-muted">{t("sentBody")}</p>
        <a href="/entrar" className="text-sm text-accent">
          {t("backToLogin")}
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">{t("title")}</h1>
      <p className="text-sm text-muted">{t("body")}</p>
      <Input name="email" type="email" label={t("email")} autoComplete="email" required />
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} fullWidth>
        {t("submit")}
      </Button>
      <a href="/entrar" className="text-center text-sm text-muted">
        {t("backToLogin")}
      </a>
    </form>
  );
}
