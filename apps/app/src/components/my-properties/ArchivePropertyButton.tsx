"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Archive } from "lucide-react";
import { Button, Modal } from "@upm/ui";
import { useCanvasSafeRouter } from "../../lib/useCanvasSafeRouter";

export type ArchivePropertyAction = (propertyId: string) => Promise<{ error?: string }>;

export type ArchivePropertyButtonProps = {
  propertyId: string;
  title: string;
  /**
   * Server Action de `actions/property-listing.ts`, injetada pela página —
   * nunca importada aqui diretamente. `archiveProperty` puxa `next/headers`
   * (server-only); importá-lo neste componente partiria a compilação de
   * qualquer canvas que o renderize (mesmo padrão do formulário Nova
   * propriedade e do wizard de autenticação da Fase 3).
   */
  onArchive: ArchivePropertyAction;
  /** Imóvel já arquivado: o botão fica visível mas inerte, para a linha não
   *  perder uma coluna de ações a meio da tabela. */
  disabled?: boolean;
};

/**
 * Botão "Arquivar" de uma linha de "As minhas propriedades" (P4-03) — abre um
 * `Modal` de confirmação e só então chama a Server Action. Um `update`
 * irreversível na UI (não há "desarquivar" nesta fase) merece confirmação.
 */
export function ArchivePropertyButton({
  propertyId,
  title,
  onArchive,
  disabled = false,
}: ArchivePropertyButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Ver `useCanvasSafeRouter`: no canvas não há router, e o do Next atira.
  const router = useCanvasSafeRouter();
  const t = useTranslations("myProperties.archive");
  const tc = useTranslations("common");

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await onArchive(propertyId);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router?.refresh();
    });
  };

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        disabled={disabled}
        title={disabled ? t("alreadyArchived") : undefined}
        leadingIcon={<Archive size={15} />}
        onClick={() => setOpen(true)}
      >
        {t("action")}
      </Button>
      <Modal
        open={open}
        onClose={() => (isPending ? undefined : setOpen(false))}
        title={t("modalTitle")}
        subtitle={title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              {tc("cancel")}
            </Button>
            <Button variant="danger" onClick={confirm} disabled={isPending}>
              {isPending ? t("pending") : t("action")}
            </Button>
          </>
        }
      >
        <p>{t("body")}</p>
        {error ? (
          <p role="alert" style={{ color: "var(--state-rejected)" }}>
            {error}
          </p>
        ) : null}
      </Modal>
    </>
  );
}
