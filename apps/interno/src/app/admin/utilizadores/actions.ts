"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import { isPasswordPwned, isStepUpRequiredError, passwordSchema } from "@upm/db/auth";

import {
  deleteStaffUser,
  recordExportedRecently,
  resetStaffMfa,
  staffExitBlockers,
  staffProfile,
  staffRecordCsv,
  type StaffExitBlockers,
} from "../../../lib/staff-access";

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
  revalidatePath("/admin/equipa");
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
 *  3. o alvo não pode ser o próprio: a sua palavra-passe e a sua 2FA muda-as
 *     o outro admin;
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

/**
 * O admin define a palavra-passe de outra pessoa da equipa (20 nov 2026)
 * ---------------------------------------------------------------------------
 * A app é da empresa: ninguém da equipa muda a própria, e a de um admin muda-a
 * o outro. A escrita é `admin_set_staff_password`, que repete na base as
 * recusas daqui, cifra a palavra-passe, termina as sessões da pessoa e regista
 * no `audit_log` quem mudou a de quem — sem a palavra-passe.
 *
 * A palavra-passe não sai daqui para lado nenhum: nem log, nem e-mail, nem
 * resposta. Quem a entrega à pessoa é o admin, de viva voz.
 */
const staffPasswordSchema = staffAccessSchema.extend({ password: passwordSchema });

export type StaffPasswordActionResult = StaffAccessActionResult & { pwned?: boolean };

export async function setStaffPassword(input: unknown): Promise<StaffPasswordActionResult> {
  const parsed = staffPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const check = await authorizeStaffAccessChange({ profileId: parsed.data.profileId });
  if ("result" in check) return check.result;
  if (check.target.status !== "active") return { error: "Only active accounts." };

  if (await isPasswordPwned(parsed.data.password)) return { pwned: true };

  const { error } = await check.supabase.rpc("admin_set_staff_password", {
    p_profile_id: check.target.id,
    p_password: parsed.data.password,
  });
  if (error) {
    if (isStepUpRequiredError(error)) return { needsStepUp: true };
    return { error: "The password could not be changed." };
  }
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

/**
 * A saída de alguém da equipa (8 nov 2026)
 * =========================================================================
 * Ver `lib/staff-access.ts`. Para além das recusas de
 * `authorizeStaffAccessChange`, as duas pedem a conta **suspensa**: bloquear
 * o acesso é o primeiro passo, e nada disto se faz a uma conta que ainda
 * entra. A eliminação pede ainda, no servidor:
 *
 *  - o trabalho passado a outra pessoa (sem leads em aberto nem caixas de
 *    correio atribuídos);
 *  - o registo descarregado nas últimas 24 h — depois, a base deixa de saber
 *    quem fez o quê, e o CSV é a única ligação.
 */
export type StaffExitActionResult = StaffAccessActionResult & {
  csv?: string;
  notSuspended?: boolean;
  needsExport?: boolean;
  blockers?: StaffExitBlockers;
};

async function authorizeStaffExit(input: unknown) {
  const check = await authorizeStaffAccessChange(input);
  if ("result" in check) return check;
  if (check.target.status !== "suspended") {
    return { ok: false as const, result: { notSuspended: true } };
  }
  return check;
}

/** O registo da pessoa, em CSV, para guardar fora do sistema antes de a eliminar. */
export async function exportStaffRecord(input: unknown): Promise<StaffExitActionResult> {
  const check = await authorizeStaffExit(input);
  if ("result" in check) return check.result;

  const csv = await staffRecordCsv(check.target.id);
  if (!csv) return { error: "The record could not be exported." };

  const audit = await check.supabase.rpc("write_audit_log", {
    p_action: "staff.record_export",
    p_entity: "profiles",
    p_entity_id: check.target.id,
    p_diff: { role: check.target.role },
  });
  if (audit.error) return { error: "The export could not be audited." };
  return { ok: true, csv };
}

/** Elimina a conta: o perfil e o login saem; nos registos, o autor passa a null. */
export async function deleteStaffAccount(input: unknown): Promise<StaffExitActionResult> {
  const check = await authorizeStaffExit(input);
  if ("result" in check) return check.result;

  const blockers = await staffExitBlockers(check.target.id);
  if (!blockers) return { error: "The account could not be checked." };
  if (blockers.openLeads > 0 || blockers.mailboxes > 0) return { blockers };
  if (!(await recordExportedRecently(check.target.id))) return { needsExport: true };

  // Primeiro o registo da eliminação, depois a eliminação: se ela falhar, o
  // `audit_log` mostra a tentativa, e não uma conta que desapareceu sem rasto.
  // Sem nome nem e-mail — a pessoa sai do sistema; o CSV é que a identifica.
  const audit = await check.supabase.rpc("write_audit_log", {
    p_action: "staff.account_deleted",
    p_entity: "profiles",
    p_entity_id: check.target.id,
    p_diff: { role: check.target.role },
  });
  if (audit.error) return { error: "The deletion could not be audited." };

  if (!(await deleteStaffUser(check.target.id))) {
    return { error: "The account could not be deleted." };
  }
  revalidatePath("/admin/utilizadores");
  revalidatePath("/admin/equipa");
  revalidatePath("/admin/painel");
  return { ok: true };
}
