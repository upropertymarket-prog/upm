/**
 * Tipos de domínio partilhados. Os tipos gerados a partir do Postgres vivem em
 * `database.types.ts` (produzidos por `pnpm db:types`); este ficheiro só
 * acrescenta aliases estáveis que o resto do monorepo importa.
 *
 * Fonte: doc 05 §6 e doc 07.
 */

export const USER_ROLES = ["buyer", "owner", "admin", "support"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROFILE_STATUSES = ["pending", "active", "suspended"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const STAFF_DEPARTMENTS = ["suporte", "financeiro", "moderacao", "admin"] as const;
export type StaffDepartment = (typeof STAFF_DEPARTMENTS)[number];

/** 03 F14 — o site público troca de modo através desta flag. */
export const LAUNCH_MODES = ["pre", "post"] as const;
export type LaunchMode = (typeof LAUNCH_MODES)[number];

export function isStaffRole(role: UserRole): boolean {
  return role === "admin" || role === "support";
}
