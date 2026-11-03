import { cookies } from "next/headers";
import { createClient, obterUtilizador } from "@upm/db/server";

/**
 * Estado da conta `pending` (07 §5.9) — 3 dias de cortesia a contar de
 * `created_at` (`verification_grace_until`), depois só leitura + modal.
 * `null` quando a conta já está `active` (nada a mostrar).
 */
export type PendingGateInfo = {
  email: string;
  daysLeft: number;
  expired: boolean;
};

export async function getPendingGateInfo(): Promise<PendingGateInfo | null> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await obterUtilizador(supabase);
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, verification_grace_until")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "pending") return null;

  const graceUntil = profile.verification_grace_until
    ? new Date(profile.verification_grace_until).getTime()
    : Date.now();
  const msLeft = graceUntil - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));

  return { email: user.email ?? "", daysLeft, expired: msLeft <= 0 };
}
