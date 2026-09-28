import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";

import { ChallengeForm } from "./ChallengeForm";

export default async function VerifyTwoFactorPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === "verified");
  if (!factor) redirect("/configurar-2fa");

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
        <ChallengeForm factorId={factor.id} />
      </div>
    </main>
  );
}
