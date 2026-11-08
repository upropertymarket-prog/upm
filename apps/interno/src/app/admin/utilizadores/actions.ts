"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import { isStepUpRequiredError } from "@upm/db/auth";

import { resetStaffMfa, sendRecoveryLink, staffProfile } from "../../../lib/staff-access";

const profileIdSchema = z.string().uuid();
const statusInputSchema = z.object({
  profileId: profileIdSchema,
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().min(3).max(500),
});

export type ProfileStatusActionResult = {
  ok?: boolean;
  needsStepUp?: boolean;
  error?: string;
};

async function getAdminClient() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return profile?.role === "admin" ? supabase : null;
}

export async function setProfileStatus(input: unknown): Promise<ProfileStatusActionResult> {
  const parsed = statusInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await getAdminClient();
  if (!supabase) return { error: "You do not have permission to change this account." };

  const { error } = await supabase.rpc("admin_set_profile_status", {
    p_profile_id: parsed.data.profileId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
  });
  if (error) {
    if (isStepUpRequiredError(error)) return { needsStepUp: true };
    return { error: "The account status could not be changed." };
  }

  revalidatePath("/admin/utilizadores");
  revalidatePath("/admin/painel");
  return { ok: true };
}

/** Fire-and-forget from the open drawer; the table render never waits for logging. */
export async function recordProfileAccess(profileId: unknown): Promise<void> {
  const parsed = profileIdSchema.safeParse(profileId);
  if (!parsed.success) return;

  const supabase = await getAdminClient();
  if (!supabase) return;
  await supabase.rpc("record_personal_data_access", {
    p_subject_type: "profile",
    p_subject_id: parsed.data,
    p_action: "view",
  });
}

/**
 * Recuperação de acesso da equipa, pelo admin (8 nov 2026)
 * =========================================================================
 * Ver `lib/staff-access.ts`. As recusas, todas no servidor, e por esta ordem:
 *
 *  1. quem pede tem de ser admin (`getAdminClient`);
 *  2. o alvo tem de ser da equipa (admin, suporte, marketing) — a conta de um
 *     cliente recupera-se pelo site, não por aqui;
 *  3. o alvo não pode ser o próprio: a sua palavra-passe recupera-a pelo
 *     "Esqueci-me", e a sua 2FA repõe-na o outro admin;
 *  4. o PIN de operação (`require_step_up`), como as outras ações sensíveis.
 *
 * Cada uma fica no `audit_log`.
 */
const staffAccessSchema = z.object({ profileId: profileIdSchema });

export type StaffAccessActionResult = ProfileStatusActionResult;

async function authorizeStaffAccessChange(input: unknown): Promise<
  | { ok: false; result: StaffAccessActionResult }
  | {
      ok: true;
      supabase: NonNullable<Awaited<ReturnType<typeof getAdminClient>>>;
      target: NonNullable<Awaited<ReturnType<typeof staffProfile>>>;
    }
> {
  const parsed = staffAccessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, result: { error: "Invalid request." } };

  const supabase = await getAdminClient();
  if (!supabase) {
    return { ok: false, result: { error: "You do not have permission to change this account." } };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === parsed.data.profileId) {
    return { ok: false, result: { error: "You cannot change your own access here." } };
  }

  const target = await staffProfile(parsed.data.profileId);
  if (!target) return { ok: false, result: { error: "This is not a team account." } };

  const { error: pinError } = await supabase.rpc("require_step_up");
  if (pinError) {
    return isStepUpRequiredError(pinError)
      ? { ok: false, result: { needsStepUp: true } }
      : { ok: false, result: { error: "PIN confirmation failed." } };
  }

  return { ok: true, supabase, target };
}

/** Envia ao próprio o link para definir uma palavra-passe nova. */
export async function resetStaffPassword(input: unknown): Promise<StaffAccessActionResult> {
  const check = await authorizeStaffAccessChange(input);
  if ("result" in check) return check.result;

  const sent = await sendRecoveryLink(check.target.email);
  if (!sent) return { error: "The recovery link could not be sent." };

  await check.supabase.rpc("write_audit_log", {
    p_action: "staff.password_reset_link",
    p_entity: "profiles",
    p_entity_id: check.target.id,
    p_diff: { role: check.target.role },
  });
  return { ok: true };
}

/** Remove a 2FA (telemóvel perdido): na entrada seguinte, a pessoa lê um QR novo. */
export async function resetStaffTwoFactor(input: unknown): Promise<StaffAccessActionResult> {
  const check = await authorizeStaffAccessChange(input);
  if ("result" in check) return check.result;

  const reset = await resetStaffMfa(check.target.id);
  if (!reset) return { error: "Two-factor authentication could not be reset." };

  await check.supabase.rpc("write_audit_log", {
    p_action: "staff.mfa_reset",
    p_entity: "profiles",
    p_entity_id: check.target.id,
    p_diff: { role: check.target.role },
  });
  return { ok: true };
}
