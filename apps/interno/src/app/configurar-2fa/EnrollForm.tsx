"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Input } from "@upm/ui";

import { verifyEnrollment, type VerifyEnrollmentState } from "./actions";

const initialState: VerifyEnrollmentState = {};

export function EnrollForm({
  factorId,
  qrCode,
  secret,
}: {
  factorId: string;
  qrCode: string;
  secret: string;
}) {
  const t = useTranslations("auth.mfa.enroll");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(verifyEnrollment, initialState);
  const [confirmed, setConfirmed] = useState(false);

  if (state.success && state.recoveryCodes && !confirmed) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold text-text">{t("recoveryCodesTitle")}</h1>
        <p className="text-sm text-muted">{t("recoveryCodesBody")}</p>
        <ul className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface2 p-4 font-mono text-sm text-text">
          {state.recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Button
          fullWidth
          onClick={() => {
            setConfirmed(true);
            router.push("/");
          }}
        >
          {t("recoveryCodesConfirm")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">{t("title")}</h1>
      <p className="text-sm text-muted">{t("body")}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URI do próprio Supabase, não otimizável pelo next/image. */}
      <img src={qrCode} alt="QR code TOTP" width={200} height={200} className="mx-auto" />
      <p className="break-all text-center font-mono text-xs text-muted">{secret}</p>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="factorId" value={factorId} />
        <Input name="code" label={t("codeLabel")} inputMode="numeric" maxLength={6} required />
        {state.error ? (
          <p className="text-sm text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} fullWidth>
          {t("submit")}
        </Button>
      </form>
    </div>
  );
}
