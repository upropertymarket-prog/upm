"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@upm/ui";

import { setPin, type SetPinState } from "./actions";

const initialState: SetPinState = {};

export function PinSetupForm() {
  const t = useTranslations("auth.pin.setup");
  const [state, formAction, pending] = useActionState(setPin, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">{t("title")}</h1>
      <p className="text-sm text-muted">{t("body")}</p>
      <Input
        name="pin"
        type="password"
        inputMode="numeric"
        label={t("pinLabel")}
        minLength={4}
        maxLength={6}
        required
      />
      <Input
        name="confirmPin"
        type="password"
        inputMode="numeric"
        label={t("confirmLabel")}
        minLength={4}
        maxLength={6}
        required
      />
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className="text-sm text-ok">✓</p> : null}
      <Button type="submit" disabled={pending} fullWidth>
        {t("submit")}
      </Button>
    </form>
  );
}
