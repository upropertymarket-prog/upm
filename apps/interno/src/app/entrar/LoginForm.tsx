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
  notice = null,
}: {
  onSubmit: (previous: LoginState, formData: FormData) => Promise<LoginState>;
  suspended?: boolean;
  /** Os avisos do caminho de recuperação: palavra-passe definida, ou link inválido. */
  notice?: "passwordSet" | "linkInvalid" | null;
}) {
  const t = useTranslations("auth.login");
  const [state, formAction, pending] = useActionState(onSubmit, initialState);

  return (
    <>
      <h1 className="text-lg font-semibold text-text">{t("title")}</h1>
      {notice === "passwordSet" ? (
        <p className="text-sm text-ok" role="status">
          {t("passwordSet")}
        </p>
      ) : null}
      {notice === "linkInvalid" ? (
        <p className="text-sm text-danger" role="alert">
          {t("linkInvalid")}
        </p>
      ) : null}
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
    </>
  );
}
