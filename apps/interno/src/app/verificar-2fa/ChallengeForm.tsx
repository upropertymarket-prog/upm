"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@upm/ui";

import { verifyChallenge, type ChallengeState } from "./actions";

const initialState: ChallengeState = {};

/**
 * Só o código da app. Os códigos de recuperação saíram a 8 nov 2026: quem
 * perdeu o telemóvel pede a um admin que lhe reponha a 2FA.
 */
export function ChallengeForm({ factorId }: { factorId: string }) {
  const t = useTranslations("auth.mfa.challenge");
  const [codeState, codeAction, codePending] = useActionState(verifyChallenge, initialState);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-semibold text-text">{t("title")}</h1>
      <form action={codeAction} className="flex flex-col gap-3">
        <input type="hidden" name="factorId" value={factorId} />
        <Input name="code" label={t("codeLabel")} inputMode="numeric" maxLength={6} required />
        {codeState.error ? (
          <p className="text-sm text-danger" role="alert">
            {codeState.error}
          </p>
        ) : null}
        <Button type="submit" disabled={codePending} fullWidth>
          {t("submit")}
        </Button>
      </form>
      <p className="text-xs text-muted">{t("lostPhone")}</p>
    </div>
  );
}
