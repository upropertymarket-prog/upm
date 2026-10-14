/**
 * Tipos de domínio partilhados. Os tipos gerados a partir do Postgres vivem em
 * `database.types.ts` (produzidos por `pnpm db:types`); este ficheiro só
 * acrescenta aliases estáveis que o resto do monorepo importa.
 *
 * Fonte: doc 05 §6 e doc 07.
 */

/** `marketing` entrou com P10-07, quando a área nasceu (07 §24.6). */
export const USER_ROLES = ["buyer", "owner", "admin", "support", "marketing"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** `deleted` entrou com P9-06: a conta eliminada esvazia-se, não desaparece. */
export const PROFILE_STATUSES = ["pending", "active", "suspended", "deleted"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const STAFF_DEPARTMENTS = [
  "suporte",
  "financeiro",
  "moderacao",
  "admin",
  "marketing",
] as const;
export type StaffDepartment = (typeof STAFF_DEPARTMENTS)[number];

/** 03 F14 — o site público troca de modo através desta flag. */
export const LAUNCH_MODES = ["pre", "post"] as const;
export type LaunchMode = (typeof LAUNCH_MODES)[number];

/**
 * A gémea de `is_staff()` no Postgres, e com a mesma fronteira: **o marketing
 * não entra**. É o eixo de permissão que decide moderação, leads, diretório de
 * utilizadores e tickets, e alargá-lo era dar tudo isso de uma vez (07 §24.6).
 */
export function isStaffRole(role: UserRole): boolean {
  return role === "admin" || role === "support";
}

/** `is_internal()`: toda a equipa interna. Só onde a intenção é mesmo essa. */
export function isInternalRole(role: UserRole): boolean {
  return role === "admin" || role === "support" || role === "marketing";
}

/** 05 §1.2 / Anexo A — Fase 2 (schema de domínio). */
export const PROPERTY_DEALS = ["sale", "rent"] as const;
export type PropertyDeal = (typeof PROPERTY_DEALS)[number];

export const PROPERTY_STATUSES = [
  "draft",
  "pending_review",
  "active",
  "featured",
  "rented",
  "sold",
  "rejected",
  "archived",
] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const PROPERTY_TYPOLOGIES = ["T0", "T1", "T2", "T3", "T4", "T5+"] as const;
export type PropertyTypology = (typeof PROPERTY_TYPOLOGIES)[number];

/** 05 §1.6 — Fase 2 (planos, ainda sem Stripe). */
export const PLAN_AUDIENCES = ["owner", "buyer", "both"] as const;
export type PlanAudience = (typeof PLAN_AUDIENCES)[number];
