"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Modal, Textarea, useToast } from "@upm/ui";
import { useCanvasSafeRouter } from "../../lib/useCanvasSafeRouter";

export type ContactActionsProps = {
  propertyId: string;
  propertyTitle: string;
  /** Server Actions injetadas por prop — um import direto partiria o canvas. */
  onContact: (propertyId: string) => Promise<{ id?: string; error?: string }>;
  onRequestVisit: (input: {
    property_id: string;
    date: string;
    time: string;
    message: string;
  }) => Promise<{ error?: string }>;
  /** O dono não se contacta a si próprio — os botões não aparecem. */
  disabled?: boolean;
  /**
   * Para onde ir depois de a conversa abrir. Por omissão é `/mensagens`, que é
   * o que a app faz. As storyboards passam um no-op: navegar a partir de uma
   * maqueta leva o iframe do canvas para uma rota que o devserver não serve, e
   * a storyboard fica presa num 404.
   */
  onOpenConversation?: (conversationId: string) => void;
};

/**
 * "Contactar proprietário" e "Pedir visita" no detalhe do Market — fecha **D20**
 * =========================================================================
 * Os dois botões estavam desativados desde a Fase 4, à espera de
 * `conversations` e `visit_requests` (08 §9, D20). Agora contactar abre (ou
 * reabre) a conversa e leva para lá; pedir visita abre o modal de 04 §8.4 e
 * cria o pedido em `pending`.
 *
 * 07 §1.2.2: o pedido de visita **inclui** o pedido de morada — não há dois
 * pedidos separados, e é por isso que este ecrã não tem um botão "pedir
 * morada".
 */
export function ContactActions({
  propertyId,
  propertyTitle,
  onContact,
  onRequestVisit,
  disabled = false,
  onOpenConversation,
}: ContactActionsProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  // Ver `useCanvasSafeRouter`: no canvas não há router, e o do Next atira.
  const router = useCanvasSafeRouter();
  const t = useTranslations("market.contact");
  const tc = useTranslations("common");

  if (disabled) return null;

  function contact() {
    startTransition(async () => {
      const result = await onContact(propertyId);
      if (result.error || !result.id) {
        toast(result.error ?? t("conversationFailed"), "error");
        return;
      }
      if (onOpenConversation) {
        onOpenConversation(result.id);
        return;
      }
      router?.push(`/mensagens?conversa=${result.id}`);
    });
  }

  function requestVisit() {
    startTransition(async () => {
      const result = await onRequestVisit({
        property_id: propertyId,
        date,
        time,
        message,
      });
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setOpen(false);
      setDate("");
      setTime("");
      setMessage("");
      toast(t("visitRequested"), "success");
    });
  }

  return (
    <>
      <Button fullWidth onClick={contact} disabled={pending}>
        {t("contactOwner")}
      </Button>
      <Button variant="secondary" fullWidth onClick={() => setOpen(true)} disabled={pending}>
        {t("requestVisit")}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("modalTitle")}
        subtitle={propertyTitle}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={requestVisit} disabled={pending || !date || !time}>
              {t("send")}
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: "var(--sp-5)" }}>
          <Input
            label={t("date")}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <Input
            label={t("time")}
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
          <Textarea
            label={t("message")}
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t("messagePlaceholder")}
            hint={t("messageHint")}
          />
        </div>
      </Modal>
    </>
  );
}
