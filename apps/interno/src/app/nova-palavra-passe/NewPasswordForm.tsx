"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@upm/ui";

import type { NewPasswordState } from "./actions";

const initialState: NewPasswordState = {};

export function NewPasswordForm({
  onSubmit,
}: {
  onSubmit: (previous: NewPasswordState, formData: FormData) => Promise<NewPasswordState>;
}) {
  const t = useTranslations("auth.recovery");
  const [state, formAction, pending] = useActionState(onSubmit, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h1 className="upm-iauth__title">{t("newPasswordTitle")}</h1>
      <p className="text-sm text-muted">{t("newPasswordSubtitle")}</p>
      <Input
        name="password"
        type="password"
        label={t("newPassword")}
        autoComplete="new-password"
        minLength={10}
        required
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
