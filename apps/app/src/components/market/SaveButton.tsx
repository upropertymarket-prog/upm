"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button, useToast } from "@upm/ui";

import type { ToggleSavedAction } from "./SavedPropertyActions";

export type SaveButtonProps = {
  propertyId: string;
  initialSaved: boolean;
  /** Server Action injetada pela página (Server Component) — ver SavedPropertyActions.ts. */
  action: ToggleSavedAction;
};

/** Botão "Guardar" / "Guardado" do detalhe de um imóvel no Market (P4-04a). */
export function SaveButton({ propertyId, initialSaved, action }: SaveButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const toggle = () => {
    startTransition(async () => {
      const result = await action(propertyId);
      if ("error" in result) {
        toast.toast(result.error, "error");
        return;
      }
      setSaved(result.saved);
    });
  };

  return (
    // Sempre secundário: a ação primária do detalhe é contactar o proprietário
    // (04 §8.4). Guardar em primário punha dois botões de acento seguidos na
    // coluna e as duas ações passavam a disputar a mesma atenção. O estado
    // guardado/por guardar lê-se no ícone e no rótulo, que chegam para isso.
    <Button
      variant="secondary"
      fullWidth
      leadingIcon={saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
      onClick={toggle}
      disabled={isPending}
    >
      {saved ? "Guardado" : "Guardar"}
    </Button>
  );
}
