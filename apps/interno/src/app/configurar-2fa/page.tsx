import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";

import { EnrollForm } from "./EnrollForm";

export default async function SetupTwoFactorPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  // Limpa fatores TOTP por verificar de tentativas anteriores (ex. QR expirado
  // sem terminar o enrolment) — nunca há mais de um fator ativo por staff.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const factor of existing?.totp ?? []) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data: enrollment, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error || !enrollment) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <p className="text-danger">Não foi possível iniciar a ativação do 2FA. Tente novamente.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
        <EnrollForm
          factorId={enrollment.id}
          qrCode={enrollment.totp.qr_code}
          secret={enrollment.totp.secret}
        />
      </div>
    </main>
  );
}
