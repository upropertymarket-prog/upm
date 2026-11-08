import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";

import { AuthCard } from "../../components/AuthCard";
import { verifyChallenge } from "./actions";
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
    <AuthCard>
      <ChallengeForm factorId={factor.id} onSubmit={verifyChallenge} />
    </AuthCard>
  );
}
