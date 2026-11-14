"use client";

import { useActionState } from "react";

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
  const [state, formAction, pending] = useActionState(verifyEnrollment, initialState);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="upm-iauth__title">{t("title")}</h1>
      <p className="text-sm text-muted">{t("body")}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URI do próprio Supabase, não otimizável pelo next/image. */}
      <img src={qrCode} alt={t("qrAlt")} width={200} height={200} className="mx-auto" />
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
