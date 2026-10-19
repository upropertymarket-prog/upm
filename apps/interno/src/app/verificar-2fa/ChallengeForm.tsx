"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@upm/ui";

import { verifyChallenge, verifyRecoveryCode, type ChallengeState } from "./actions";

const initialState: ChallengeState = {};

export function ChallengeForm({ factorId }: { factorId: string }) {
  const t = useTranslations("auth.mfa.challenge");
  const [useRecovery, setUseRecovery] = useState(false);
  const [codeState, codeAction, codePending] = useActionState(verifyChallenge, initialState);
  const [recoveryState, recoveryAction, recoveryPending] = useActionState(
    verifyRecoveryCode,
    initialState,
  );

  if (useRecovery) {
    return (
      <form action={recoveryAction} className="flex flex-col gap-3">
        <Input name="recoveryCode" label={t("recoveryLabel")} required />
        {recoveryState.error ? (
          <p className="text-sm text-danger" role="alert">
            {recoveryState.error}
          </p>
        ) : null}
        <Button type="submit" disabled={recoveryPending} fullWidth>
          {t("submit")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setUseRecovery(false)}>
          {t("codeLabel")}
        </Button>
      </form>
    );
  }

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
      <Button type="button" variant="ghost" size="sm" onClick={() => setUseRecovery(true)}>
        {t("useRecoveryCode")}
      </Button>
    </div>
  );
}
