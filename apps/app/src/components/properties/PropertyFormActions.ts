import type { Tables } from "@upm/db";
import type {
  CharacteristicsStepInput,
  IdentificationStepInput,
  LocationStepInput,
  PriceStepInput,
} from "@upm/db/properties";

/**
 * Estado completo de um imóvel para o modo editar. Omite `location`: é a
 * coordenada exata, privada (nunca select direto para o cliente — só
 * `location_approx` sai daqui).
 */
export type PropertyDraft = Omit<Tables<"properties">, "location">;

/** Uma fotografia/planta já gravada em `property_media`. */
export type PropertyMediaItem = Pick<
  Tables<"property_media">,
  "id" | "path" | "kind" | "position" | "is_cover"
>;

/**
 * Tipos das Server Actions do formulário "Nova propriedade" (P4-02)
 * =========================================================================
 * Só tipos — sem `"use server"`, sem `next/headers`, sem importar o módulo
 * real de `app/actions/properties.ts`. Regra da Fase 3 (08 §7.3): componentes
 * em `components/**` recebem as actions por prop, nunca as importam
 * diretamente, para continuarem compiláveis fora do contexto do servidor Next
 * (ex. um futuro canvas do Tempo).
 */

export type SaveStepAction<T> = (propertyId: string, data: T) => Promise<{ error?: string }>;

export type PropertyFormActions = {
  createDraft: () => Promise<{ id: string } | { error: string }>;
  saveIdentification: SaveStepAction<IdentificationStepInput>;
  saveCharacteristics: SaveStepAction<CharacteristicsStepInput>;
  saveLocation: SaveStepAction<LocationStepInput>;
  savePrice: SaveStepAction<PriceStepInput>;
  uploadMedia: (propertyId: string, formData: FormData) => Promise<{ error?: string }>;
  reorderMedia: (propertyId: string, mediaIds: string[]) => Promise<{ error?: string }>;
  setCoverMedia: (propertyId: string, mediaId: string) => Promise<{ error?: string }>;
  deleteMedia: (propertyId: string, mediaId: string) => Promise<{ error?: string }>;
  uploadDocument: (propertyId: string, formData: FormData) => Promise<{ error?: string }>;
  publish: (propertyId: string) => Promise<{ error?: string }>;
};
