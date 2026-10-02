"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import { isStepUpRequiredError } from "@upm/db/auth";

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
