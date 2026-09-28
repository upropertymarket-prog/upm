"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@upm/ui";

import { signIn, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const t = useTranslations("auth.login");
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="email" type="email" label={t("email")} autoComplete="email" required />
      <Input
        name="password"
        type="password"
        label={t("password")}
        autoComplete="current-password"
        required
      />
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
