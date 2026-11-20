"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@upm/ui";

import type { LoginState } from "./actions";

const initialState: LoginState = {};

/**
 * O ecrã de entrada do interno: o título, os avisos que vêm pelo URL e o
 * formulário.
 *
 * A action vem por prop (8 nov 2026): importá-la aqui punha um `"use server"`
 * no grafo do canvas, e isso deixa as storyboards em branco. Pela mesma razão
 * os avisos vêm por prop e não do `searchParams` — a página lê-os e passa-os.
 */
export function LoginForm({
  onSubmit,
  suspended = false,
}: {
  onSubmit: (previous: LoginState, formData: FormData) => Promise<LoginState>;
  suspended?: boolean;
}) {
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState(onSubmit, initialState);

  return (
    <>
      <h1 className="upm-iauth__title">{t("title")}</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <Input name="email" type="email" label={t("email")} autoComplete="email" required />
        <Input
          name="password"
          type="password"
          revealLabels={{ show: tCommon("showPassword"), hide: tCommon("hidePassword") }}
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
        {/* Sem "Esqueci-me" (20 nov 2026): a palavra-passe da equipa muda-a
            um admin, a de um admin muda-a o outro. */}
        <p className="text-center text-sm text-muted">{t("staffForgotPassword")}</p>
      </form>
    </>
  );
}
