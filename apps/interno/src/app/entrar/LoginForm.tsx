"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@upm/ui";

import { signIn, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ suspended = false }: { suspended?: boolean }) {
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
      {suspended || state.suspended ? (
        <p className="text-sm text-danger" role="alert">
          {t("suspended")}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} fullWidth>
        {t("submit")}
      </Button>
      {/* Só para admins (8 nov 2026): a página explica, e o resto da equipa
          pede a um admin. */}
      <a href="/recuperar" className="text-center text-sm text-muted">
        {t("forgotPassword")}
      </a>
    </form>
  );
}
