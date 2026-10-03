"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import { isStepUpRequiredError } from "@upm/db/auth";

const actionSchema = z
  .object({
    propertyId: z.string().uuid(),
    action: z.enum(["approve", "reject", "feature", "unfeature", "reopen"]),
    reason: z.string().trim().max(500).optional().default(""),
  })
  .superRefine((input, context) => {
    if (input.action === "reject" && input.reason.length < 3) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "A rejection reason is required.",
      });
    }
  });

export type ModerationActionResult = {
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

export async function moderateProperty(input: unknown): Promise<ModerationActionResult> {
  const parsed = actionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid moderation request." };

  const supabase = await getAdminClient();
  if (!supabase) return { error: "You do not have permission to moderate this property." };

  const { error } = await supabase.rpc("moderate_property", {
    p_property_id: parsed.data.propertyId,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason,
  });
  if (error) {
    if (isStepUpRequiredError(error)) return { needsStepUp: true };
    return { error: "The moderation decision could not be saved." };
  }

  revalidatePath("/admin/imoveis");
  revalidatePath("/admin/painel");
  revalidatePath("/propriedades");
  return { ok: true };
}
