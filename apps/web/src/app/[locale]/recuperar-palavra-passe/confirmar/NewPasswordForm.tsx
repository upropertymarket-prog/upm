"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@upm/ui";

/**
 * Definido aqui, não em `../actions`: `actions.ts` importa `next/headers`
 * (server-only) e importá-lo — mesmo só o tipo — parte a compilação do
 * canvas para o projeto inteiro. `../actions` importa este tipo daqui.
 */
export type SetNewPasswordState = { error?: string };

const initialState: SetNewPasswordState = {};

export type NewPasswordFormProps = {
  /**
   * Injetada pela página (`action={setNewPassword}`), nunca importada aqui:
   * puxa `next/headers` (server-only), e importá-lo neste componente parte a
   * compilação do canvas para o projeto inteiro.
   */
  action: (state: SetNewPasswordState, formData: FormData) => Promise<SetNewPasswordState>;
};

export function NewPasswordForm({ action }: NewPasswordFormProps) {
  const t = useTranslations("auth.recovery");
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="upm-auth__heading">
        <h1 className="upm-auth__title">{t("newPasswordTitle")}</h1>
        <p className="upm-auth__subtitle">{t("newPasswordSubtitle")}</p>
      </div>
      <Input
        name="password"
        type="password"
        label={t("newPassword")}
        autoComplete="new-password"
        required
        minLength={10}
      />
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} fullWidth>
        {t("submitNewPassword")}
      </Button>
    </form>
  );
}
