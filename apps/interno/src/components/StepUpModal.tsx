"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { Button, Input, Modal } from "@upm/ui";

import type { StepUpState, VerifyPinAction } from "./stepUpTypes";

/**
 * Modal de step-up do PIN — P8-07 (07 §6, decisão em 07 §21.1)
 * =========================================================================
 * Aparece quando uma ação sensível devolve `step_up_required`. O caminho é
 * sempre o mesmo: a ação de negócio é recusada **pelo servidor**, o modal pede
 * o PIN, e a ação repete-se. A interface nunca decide se o step-up é preciso —
 * só reage à recusa (08: "nunca confiar apenas na proteção da UI").
 *
 * A mensagem de erro é uma só, qualquer que seja a causa — ver a nota 1 em
 * `app/actions/step-up.ts`.
 */

const initialState: StepUpState = {};

export type StepUpModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void;
  /**
   * `verifyOperationPin` em produção. Entra por prop para este ficheiro não
   * importar a Server Action: o módulo dela usa `next/headers`, e isso arrasta
   * um módulo só-de-servidor para o bundle do canvas.
   */
  onVerify: VerifyPinAction;
};

export function StepUpModal({ open, onClose, onConfirmed, onVerify }: StepUpModalProps) {
  const t = useTranslations("auth.pin.stepUp");
  const tc = useTranslations("common");
  const [state, formAction, pending] = useActionState(onVerify, initialState);

  // `onConfirmed` reabre a ação de negócio; o efeito corre uma vez por
  // confirmação, não a cada render em que o estado continua `ok`.
  const confirmedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      confirmedRef.current = false;
      return;
    }
    if (state.ok && !confirmedRef.current) {
      confirmedRef.current = true;
      onConfirmed();
    }
  }, [open, state.ok, onConfirmed]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t("title")}
      icon={<ShieldCheck size={17} />}
      closeLabel={tc("close")}
    >
      <form action={formAction} className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("body")}</p>
        <Input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          label={t("pinLabel")}
          minLength={4}
          maxLength={6}
          required
          autoFocus
        />
        {state.error ? (
          <p className="text-sm text-danger" role="alert">
            {state.retryAfterSeconds
              ? t("throttled", { seconds: state.retryAfterSeconds })
              : t("error")}
          </p>
        ) : null}
        <p className="text-sm text-muted">
          {t("noPin")}{" "}
          <a className="text-accent underline" href="/definicoes/seguranca">
            {t("setPin")}
          </a>
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {t("submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Encapsula o par "ação recusada → pedir PIN → repetir a ação".
 *
 * ```tsx
 * const { requestStepUp, stepUpModal } = useStepUp(verifyOperationPin);
 * // …
 * const result = await savePlan(formData);
 * if (result.needsStepUp) requestStepUp(() => void savePlan(formData));
 * // …
 * {stepUpModal}
 * ```
 *
 * A função de repetição fica guardada até o PIN ser confirmado, para o
 * utilizador não ter de preencher o formulário outra vez — perder o trabalho
 * por causa de uma confirmação de segurança ensina a evitar a segurança.
 */
export function useStepUp(onVerify: VerifyPinAction) {
  // A função de repetição vive numa ref, não no estado: chamá-la dentro de um
  // `setState` fá-la correr duas vezes em modo estrito.
  const retryRef = useRef<(() => void) | null>(null);
  const [open, setOpen] = useState(false);

  const requestStepUp = useCallback((onConfirmedRetry: () => void) => {
    retryRef.current = onConfirmedRetry;
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    retryRef.current = null;
    setOpen(false);
  }, []);

  const confirmed = useCallback(() => {
    const retry = retryRef.current;
    retryRef.current = null;
    setOpen(false);
    retry?.();
  }, []);

  return {
    requestStepUp,
    stepUpOpen: open,
    stepUpModal: (
      <StepUpModal open={open} onClose={close} onConfirmed={confirmed} onVerify={onVerify} />
    ),
  };
}
