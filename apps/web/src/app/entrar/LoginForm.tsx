"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button, Input } from "@upm/ui";

/**
 * Definido aqui, não em `./actions`: `actions.ts` importa `next/headers`
 * (server-only) e importá-lo — mesmo só o tipo — parte a compilação do
 * canvas para o projeto inteiro. `./actions` importa este tipo daqui.
 */
export type LoginState = { error?: string };

const initialState: LoginState = {};

export type LoginFormProps = {
  next?: string;
  /**
   * Injetada pela página (`action={signIn}`), nunca importada aqui: `signIn`
   * puxa `next/headers` (server-only), e importá-lo neste componente parte a
   * compilação do canvas para o projeto inteiro. O canvas passa uma ação de
   * demonstração em vez da real.
   */
  action: (state: LoginState, formData: FormData) => Promise<LoginState>;
};

export function LoginForm({ next, action }: LoginFormProps) {
  const t = useTranslations("auth.login");
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      {/* Honeypot (08 §7.6) — invisível a humanos, os bots preenchem tudo. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
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
      {/* Só a recuperação fica no formulário. A troca para "criar conta" vive
          no `AuthShell`, abaixo do cartão (7 out 2026) — tê-la nos dois sítios
          era repetir o mesmo link a dois centímetros de distância. */}
      <div className="text-sm">
        <Link href="/recuperar-palavra-passe" className="text-accent hover:underline">
          {t("forgotPassword")}
        </Link>
      </div>
    </form>
  );
}
