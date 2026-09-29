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
    <Button
      variant={saved ? "secondary" : "primary"}
      leadingIcon={saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
      onClick={toggle}
      disabled={isPending}
    >
      {saved ? "Guardado" : "Guardar"}
    </Button>
  );
}
