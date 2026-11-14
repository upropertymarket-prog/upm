"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { useTranslations } from "next-intl";
import { Button, Input } from "@upm/ui";

import {
  startEnrollment,
  verifyEnrollment,
  type Enrollment,
  type VerifyEnrollmentState,
} from "./actions";

const initialState: VerifyEnrollmentState = {};

/**
 * O QR nasce aqui, uma vez, e fica no estado do componente (14 nov 2026): um
 * código errado — ou o re-render que vem na resposta da action — já não troca
 * o fator que a pessoa leu com a app. Ver `startEnrollment`.
 */
export function EnrollForm() {
  const t = useTranslations("auth.mfa.enroll");
  const [state, formAction, pending] = useActionState(verifyEnrollment, initialState);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  // Em desenvolvimento o React corre o efeito duas vezes; o segundo fator
  // apagava o primeiro e o QR mostrado deixava de valer.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startEnrollment().then(setEnrollment, () => setEnrollment({ error: "startFailed" }));
  }, []);

  if (enrollment && "error" in enrollment) {
    return <p className="text-danger">{t("startFailed")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="upm-iauth__title">{t("title")}</h1>
      <p className="text-sm text-muted">{t("body")}</p>
      {enrollment ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URI do próprio Supabase, não otimizável pelo next/image. */}
          <img
            src={enrollment.qrCode}
            alt={t("qrAlt")}
            width={200}
            height={200}
            className="mx-auto"
          />
          <p className="break-all text-center font-mono text-xs text-muted">{enrollment.secret}</p>
        </>
      ) : (
        <div
          className="mx-auto h-[200px] w-[200px] rounded-xl bg-surface2"
          aria-busy="true"
          aria-hidden="true"
        />
      )}
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="factorId" value={enrollment?.factorId ?? ""} />
        <Input name="code" label={t("codeLabel")} inputMode="numeric" maxLength={6} required />
        {state.error ? (
          <p className="text-sm text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending || !enrollment} fullWidth>
          {t("submit")}
        </Button>
      </form>
    </div>
  );
}
