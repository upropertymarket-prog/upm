"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@upm/ui";

import { resendVerificationEmail, type ResendState } from "../actions";

const initialState: ResendState = {};

export function ResendVerificationForm({ email }: { email: string }) {
  const t = useTranslations("auth.register.verification");
  const [state, formAction, pending] = useActionState(resendVerificationEmail, initialState);

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
