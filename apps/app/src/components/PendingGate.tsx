"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Modal } from "@upm/ui";

import {
  changeEmail,
  resendVerificationEmail,
  type ChangeEmailState,
  type ResendState,
} from "../app/actions/auth";
import type { PendingGateInfo } from "../lib/pending-gate";

const initialResend: ResendState = {};
const initialChangeEmail: ChangeEmailState = {};

function ResendButton() {
  const t = useTranslations("auth.pendingGate");
  const [state, formAction, pending] = useActionState(resendVerificationEmail, initialResend);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {t("resend")}
      </Button>
      {state.sent ? <span className="text-sm text-ok">✓</span> : null}
      {state.error ? (
        <span className="text-sm text-danger" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function ChangeEmailForm() {
  const t = useTranslations("auth.pendingGate");
  const [state, formAction, pending] = useActionState(changeEmail, initialChangeEmail);

  if (state.sent) {
    return <p className="text-sm text-ok">{t("resend")}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Input name="email" type="email" label={t("changeEmail")} required />
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("changeEmail")}
      </Button>
    </form>
  );
}

/** Banner (dias 1–3) e modal bloqueante (fim do dia 3) de 07 §5.9. */
export function PendingGate({ info }: { info: PendingGateInfo | null }) {
  const t = useTranslations("auth.pendingGate");
  const [dismissed, setDismissed] = useState(false);

  if (!info) return null;

  if (!info.expired) {
    return (
      <div className="flex items-center justify-between gap-4 bg-warn-soft px-4 py-2 text-sm text-text">
        <span>{t("bannerTitle", { days: info.daysLeft })}</span>
        <ResendButton />
      </div>
    );
  }

  return (
    <Modal
      open={!dismissed}
      onClose={() => setDismissed(true)}
      title={t("modalTitle")}
      footer={
        <Button variant="secondary" onClick={() => setDismissed(true)}>
          {t("modalBody")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("modalBody")}</p>
        <ResendButton />
        <ChangeEmailForm />
      </div>
    </Modal>
  );
}
