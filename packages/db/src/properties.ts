import { z } from "zod";

/**
 * Imóveis (Fase 4) — 05 §1.2, 07 §17.2.
 * =========================================================================
 * `property_type` e `condition` são `text` livre na base de dados (07 §17.2:
 * a lista definitiva entra com este formulário, sem alterar a migração).
 * As listas abaixo são a decisão fechada nesta fase — validadas só aqui, no
 * `zod`, nunca por `check` na coluna.
 */

export const PROPERTY_TYPES = [
  "Apartamento",
  "Moradia",
  "Loft",
  "Estúdio",
  "Terreno",
  "Quinta",
  "Escritório",
] as const;
export const propertyTypeSchema = z.enum(PROPERTY_TYPES);
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_CONDITIONS = [
  "Novo",
  "Usado — bom estado",
  "Remodelado",
  "Para recuperar",
] as const;
export const propertyConditionSchema = z.enum(PROPERTY_CONDITIONS);
export type PropertyCondition = (typeof PROPERTY_CONDITIONS)[number];

// `typology` já tem `check` na migração (05 Anexo A) — replicado aqui só para
// validar no formulário antes de ir ao servidor, não substitui o `check`.
export const TYPOLOGIES = ["T0", "T1", "T2", "T3", "T4", "T5+"] as const;
export const typologySchema = z.enum(TYPOLOGIES);
export type Typology = (typeof TYPOLOGIES)[number];

export const DEALS = ["sale", "rent"] as const;
export const dealSchema = z.enum(DEALS);
export type Deal = (typeof DEALS)[number];

// ---------------------------------------------------------------------------
// Passos do formulário "Nova propriedade" (P4-02) — cada um valida só os
// campos desse passo; a Server Action confirma posse por cima (08 §7.3).
// ---------------------------------------------------------------------------

export const identificationStepSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório").max(160),
  deal: dealSchema,
  property_type: propertyTypeSchema,
  typology: typologySchema,
  condition: propertyConditionSchema,
  description: z.string().trim().max(5000),
});
export type IdentificationStepInput = z.infer<typeof identificationStepSchema>;

export const characteristicsStepSchema = z.object({
  gross_area: z.number().positive().max(100_000).nullable(),
  net_area: z.number().positive().max(100_000).nullable(),
  bedrooms: z.number().int().min(0).max(50).nullable(),
  bathrooms: z.number().int().min(0).max(50).nullable(),
  floor: z.string().trim().max(20).nullable(),
  year_built: z
    .number()
    .int()
    .min(1800)
    .max(new Date().getFullYear() + 5)
    .nullable(),
  energy_cert: z.string().trim().max(10).nullable(),
  amenities: z.array(z.string().trim().min(1).max(60)).max(50),
});
export type CharacteristicsStepInput = z.infer<typeof characteristicsStepSchema>;

export const locationStepSchema = z.object({
  address_line: z.string().trim().min(1, "Morada obrigatória").max(200),
  postal_code: z.string().trim().max(20),
  city: z.string().trim().min(1, "Cidade obrigatória").max(120),
  parish: z.string().trim().max(120),
  district: z.string().trim().max(120),
  show_exact: z.boolean(),
});
export type LocationStepInput = z.infer<typeof locationStepSchema>;

export const priceStepSchema = z
  .object({
    price_cents: z.number().int().nonnegative().nullable(),
    rent_cents: z.number().int().nonnegative().nullable(),
    condo_fee_cents: z.number().int().nonnegative().nullable(),
    imi_cents: z.number().int().nonnegative().nullable(),
    accepts_offers: z.boolean(),
  })
  .refine((value) => value.price_cents !== null || value.rent_cents !== null, {
    message: "Indica pelo menos um preço (venda ou arrendamento)",
    path: ["price_cents"],
  });
export type PriceStepInput = z.infer<typeof priceStepSchema>;

// ---------------------------------------------------------------------------
// Filtros de pesquisa (Market P4-04a e Alertas P4-04b) — o mesmo shape serve
// para os query params do Market e para `search_alerts.filters`.
// ---------------------------------------------------------------------------

export const propertyFiltersSchema = z.object({
  deal: dealSchema.optional(),
  property_type: propertyTypeSchema.optional(),
  typology: typologySchema.optional(),
  price_min_cents: z.number().int().nonnegative().optional(),
  price_max_cents: z.number().int().nonnegative().optional(),
  city: z.string().trim().max(120).optional(),
});
export type PropertyFilters = z.infer<typeof propertyFiltersSchema>;
