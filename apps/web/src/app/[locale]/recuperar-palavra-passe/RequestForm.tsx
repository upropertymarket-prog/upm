"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@upm/ui";

/**
 * Definido aqui, não em `./actions`: `actions.ts` importa `next/headers`
 * (server-only) e importá-lo — mesmo só o tipo — parte a compilação do
 * canvas para o projeto inteiro. `./actions` importa este tipo daqui.
 */
export type RequestRecoveryState = { sent?: boolean; error?: string };

const initialState: RequestRecoveryState = {};

export type RequestFormProps = {
  /**
   * Injetada pela página (`action={requestPasswordReset}`), nunca importada
   * aqui: puxa `next/headers` (server-only), e importá-lo neste componente
   * parte a compilação do canvas para o projeto inteiro.
   */
  action: (state: RequestRecoveryState, formData: FormData) => Promise<RequestRecoveryState>;
};

export function RequestForm({ action }: RequestFormProps) {
  const t = useTranslations("auth.recovery");
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.sent) {
    return (
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-lg font-semibold text-text">{t("sentTitle")}</h1>
        <p className="text-sm text-muted">{t("sentBody")}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">{t("title")}</h1>
      <Input name="email" type="email" label={t("email")} autoComplete="email" required />
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} fullWidth>
        {t("submit")}
      </Button>
    </form>
  );
}
