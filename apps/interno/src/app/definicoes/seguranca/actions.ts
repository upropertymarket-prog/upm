"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";
import { hashPin, pinSchema } from "@upm/db/auth";

export type SetPinState = { error?: string; success?: boolean };

/** Define/altera o PIN de operação (07 §6) — Argon2id, distinto da palavra-passe. */
export async function setPin(_prev: SetPinState, formData: FormData): Promise<SetPinState> {
  const t = { mismatch: "Os PINs não coincidem." };
  const pinResult = pinSchema.safeParse(formData.get("pin"));
  const confirmResult = pinSchema.safeParse(formData.get("confirmPin"));

  if (!pinResult.success) return { error: "O PIN tem de ter entre 4 e 6 dígitos." };
  if (!confirmResult.success || pinResult.data !== confirmResult.data) {
    return { error: t.mismatch };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const pinHash = await hashPin(pinResult.data);
  const { error } = await supabase
    .from("staff_auth")
    .upsert(
      { profile_id: user.id, pin_hash: pinHash, pin_updated_at: new Date().toISOString() },
      { onConflict: "profile_id" },
    );

  if (error) return { error: "Não foi possível guardar o PIN. Tente novamente." };
  return { success: true };
}
