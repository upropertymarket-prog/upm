"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@upm/ui";

/**
 * Definido aqui, não em `../actions`: esse ficheiro importa `next/headers`
 * (server-only) e importá-lo — mesmo só o tipo — parte a compilação do canvas
 * para o projeto inteiro. `../actions` importa este tipo daqui.
 */
export type ResendState = { sent?: boolean; error?: string };

const initialState: ResendState = {};

export type ResendVerificationFormProps = {
  email: string;
  /**
   * Injetada pela página (`action={resendVerificationEmail}`), nunca importada
   * aqui — mesma razão do `LoginForm`. O canvas passa uma ação de
   * demonstração em vez da real.
   */
  action: (state: ResendState, formData: FormData) => Promise<ResendState>;
};

export function ResendVerificationForm({ email, action }: ResendVerificationFormProps) {
  const t = useTranslations("auth.register.verification");
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col items-center gap-2">
      <input type="hidden" name="email" value={email} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("resend")}
      </Button>
      {state.sent ? <p className="text-sm text-ok">{t("resendSuccess")}</p> : null}
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
