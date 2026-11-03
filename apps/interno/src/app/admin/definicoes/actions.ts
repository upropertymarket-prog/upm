"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SITE_CACHE_TAGS, invalidarCacheDoSite } from "@upm/config/site-cache";
import { createClient } from "@upm/db/server";
import { isStepUpRequiredError } from "@upm/db/auth";

const flagSchema = z.discriminatedUnion("key", [
  z.object({ key: z.literal("launch_mode"), value: z.enum(["pre", "post"]) }),
  z.object({ key: z.literal("interno_ip_allowlist"), value: z.array(z.string().max(64)).max(64) }),
]);
const settingSchema = z
  .object({
    key: z.enum([
      "company_name",
      "company_tax_id",
      "company_address",
      "company_phone",
      "company_email",
      "billing_email",
    ]),
    value: z.string().max(500),
  })
  .superRefine(({ key, value }, context) => {
    if (
      (key === "company_email" || key === "billing_email") &&
      value.trim() !== "" &&
      !z.string().email().safeParse(value).success
    ) {
      context.addIssue({ code: "custom", message: "Invalid email address.", path: ["value"] });
    }
  });
export type SettingsActionResult = { ok?: boolean; needsStepUp?: boolean; error?: string };

async function adminClient() {
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

export async function saveFeatureFlag(input: unknown): Promise<SettingsActionResult> {
  const parsed = flagSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid setting." };
  const supabase = await adminClient();
  if (!supabase) return { error: "Not authorized." };
  const value =
    parsed.data.key === "interno_ip_allowlist"
      ? parsed.data.value.map((item) => item.trim()).filter(Boolean)
      : parsed.data.value;
  const { error } = await supabase.rpc("set_feature_flag", {
    p_key: parsed.data.key,
    p_value: value,
  });
  if (error)
    return isStepUpRequiredError(error)
      ? { needsStepUp: true }
      : { error: "Could not save the feature flag." };
  revalidatePath("/admin/definicoes");
  // O modo de lançamento é lido pelo `www`, noutro processo: um
  // `revalidatePath` daqui não lhe chega. Pede-se pela etiqueta (F2).
  if (parsed.data.key === "launch_mode") {
    after(() => invalidarCacheDoSite([SITE_CACHE_TAGS.launchMode]));
  }
  return { ok: true };
}

export async function saveCompanySetting(input: unknown): Promise<SettingsActionResult> {
  const parsed = settingSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid company setting." };
  const supabase = await adminClient();
  if (!supabase) return { error: "Not authorized." };
  const { error } = await supabase.rpc("set_app_setting", {
    p_key: parsed.data.key,
    p_value: parsed.data.value,
  });
  if (error)
    return isStepUpRequiredError(error)
      ? { needsStepUp: true }
      : { error: "Could not save company information." };
  revalidatePath("/admin/definicoes");
  revalidatePath("/", "layout");
  return { ok: true };
}
