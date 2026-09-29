"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { Button, Modal } from "@upm/ui";

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
}: ArchivePropertyButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await onArchive(propertyId);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        leadingIcon={<Archive size={15} />}
        onClick={() => setOpen(true)}
      >
        Arquivar
      </Button>
      <Modal
        open={open}
        onClose={() => (isPending ? undefined : setOpen(false))}
        title="Arquivar imóvel"
        subtitle={title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirm} disabled={isPending}>
              {isPending ? "A arquivar…" : "Arquivar"}
            </Button>
          </>
        }
      >
        <p>
          O imóvel deixa de aparecer no Market. Esta ação não tem &ldquo;desarquivar&rdquo; nesta
          fase — para voltar a publicar é preciso criar um novo anúncio.
        </p>
        {error ? (
          <p role="alert" style={{ color: "var(--state-rejected)" }}>
            {error}
          </p>
        ) : null}
      </Modal>
    </>
  );
}
