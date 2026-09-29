"use client";

import { useRef, useState } from "react";
import { Button } from "@upm/ui";
import { createClient } from "@upm/db/client";

import type { PropertyFormActions, PropertyMediaItem } from "../PropertyFormActions";

const MEDIA_BUCKET = "property-media";

export type PhotosStepProps = {
  propertyId: string;
  media: PropertyMediaItem[];
  onMediaChange: (media: PropertyMediaItem[]) => void;
  actions: Pick<
    PropertyFormActions,
    "uploadMedia" | "reorderMedia" | "setCoverMedia" | "deleteMedia"
  >;
  error?: string;
};

type PendingPreview = { key: string; url: string };

/**
 * Passo 5 do wizard "Nova propriedade" (P4-02) — fotografias.
 *
 * `media` é o estado controlado das fotografias já gravadas (padrão dos
 * outros passos); depois de cada mutação (upload/reordenar/capa/apagar) volta
 * a ler `property_media` diretamente (leitura protegida por RLS, não é uma
 * Server Action) e propaga a lista atualizada via `onMediaChange` — as Server
 * Actions não devolvem as linhas criadas, só `{ error? }` (padrão do projeto).
 */
export function PhotosStep({ propertyId, media, onMediaChange, actions, error }: PhotosStepProps) {
  const [pending, setPending] = useState<PendingPreview[]>([]);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const dragIndex = useRef<number | null>(null);
  const [supabase] = useState(() => createClient());

  function publicUrl(path: string): string {
    return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function refreshMedia() {
    const { data } = await supabase
      .from("property_media")
      .select("id, path, kind, position, is_cover")
      .eq("property_id", propertyId)
      .order("position", { ascending: true });
    onMediaChange(data ?? []);
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const previews = files.map((file) => ({
      key: `${file.name}-${file.size}-${Date.now()}`,
      url: URL.createObjectURL(file),
    }));
    setPending((current) => [...current, ...previews]);
    setLocalError(undefined);
    setBusy(true);

    const formData = new FormData();
    for (const file of files) formData.append("files", file);

    const result = await actions.uploadMedia(propertyId, formData);
    setBusy(false);
    setPending((current) => current.filter((item) => !previews.includes(item)));
    for (const preview of previews) URL.revokeObjectURL(preview.url);

    if (result.error) {
      setLocalError(result.error);
      return;
    }
    await refreshMedia();
  }

  async function handleSetCover(mediaId: string) {
    setLocalError(undefined);
    const result = await actions.setCoverMedia(propertyId, mediaId);
    if (result.error) {
      setLocalError(result.error);
      return;
    }
    await refreshMedia();
  }

  async function handleDelete(mediaId: string) {
    setLocalError(undefined);
    const result = await actions.deleteMedia(propertyId, mediaId);
    if (result.error) {
      setLocalError(result.error);
      return;
    }
    await refreshMedia();
  }

  async function handleDrop(targetIndex: number) {
    const sourceIndex = dragIndex.current;
    dragIndex.current = null;
    if (sourceIndex === null || sourceIndex === targetIndex) return;

    const reordered = [...media];
    const [moved] = reordered.splice(sourceIndex, 1);
    if (!moved) return;
    reordered.splice(targetIndex, 0, moved);
    onMediaChange(reordered);

    const result = await actions.reorderMedia(
      propertyId,
      reordered.map((item) => item.id),
    );
    if (result.error) {
      setLocalError(result.error);
      await refreshMedia();
    }
  }

  const shownError = error ?? localError;

  return (
    <div className="upm-form-grid">
      <div className="upm-field">
        <label className="upm-field__label" htmlFor="property-photos-input">
          Fotografias
        </label>
        <input
          id="property-photos-input"
          type="file"
          multiple
          accept="image/*"
          disabled={busy}
          onChange={(event) => {
            void handleFilesSelected(event.target.files);
            event.target.value = "";
          }}
        />
        {shownError ? (
          <span className="upm-field__error" role="alert">
            {shownError}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {media.map((item, index) => (
          <div
            key={item.id}
            className="border-border relative flex flex-col gap-2 rounded-lg border p-2 data-[cover=true]:ring-accent data-[cover=true]:ring-2"
            draggable
            onDragStart={() => {
              dragIndex.current = index;
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => void handleDrop(index)}
            data-cover={item.is_cover ? "true" : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- ficheiro de storage do utilizador, não um asset estático */}
            <img
              src={publicUrl(item.path)}
              alt=""
              className="aspect-square rounded-md object-cover"
            />
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                size="sm"
                variant={item.is_cover ? "secondary" : "ghost"}
                disabled={item.is_cover}
                onClick={() => void handleSetCover(item.id)}
              >
                {item.is_cover ? "Capa" : "Definir como capa"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => void handleDelete(item.id)}
              >
                Remover
              </Button>
            </div>
          </div>
        ))}

        {pending.map((preview) => (
          <div
            key={preview.key}
            className="border-border relative flex flex-col gap-2 rounded-lg border p-2 opacity-60"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização local via blob URL */}
            <img src={preview.url} alt="" className="aspect-square rounded-md object-cover" />
            <span className="text-muted text-sm">A enviar…</span>
          </div>
        ))}
      </div>
    </div>
  );
}
