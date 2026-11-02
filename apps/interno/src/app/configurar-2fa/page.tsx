import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";

import { EnrollForm } from "./EnrollForm";

export default async function SetupTwoFactorPage() {
  const supabase = createClient(await cookies());
  const t = await getTranslations("auth.mfa.enroll");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: existing } = await supabase.auth.mfa.listFactors();
  const totp = (existing?.all ?? []).filter((factor) => factor.factor_type === "totp");

  // Com um fator **verificado**, esta página só se desenha num caso: logo a
  // seguir à configuração. A Server Action mexe nos cookies, e o Next volta a
  // desenhar a página dentro da mesma resposta — é nessa resposta que o
  // formulário mostra os códigos de recuperação. Aqui não se cria nem se
  // apaga nada, e não se redireciona (levava a pessoa embora antes de ver os
  // códigos): devolve-se o mesmo ecrã, e o estado do cliente mantém os códigos.
  // Uma visita normal com 2FA já não chega cá — o middleware desvia-a.
  //
  // Até 2 nov o filtro de baixo apanhava também os fatores verificados: nesta
  // mesma re-renderização, a página apagava o fator acabado de verificar. O 2FA
  // de staff nunca ficava — cada entrada voltava a "configure o 2FA". Foi o E2E
  // do A5 que o mostrou.
  const verified = totp.find((factor) => factor.status === "verified");
  if (verified) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
        <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
          <EnrollForm factorId={verified.id} qrCode="" secret="" />
        </div>
      </main>
    );
  }

  // Limpa só os fatores **por verificar** de tentativas anteriores (QR
  // expirado sem terminar) — nunca há mais de um fator ativo por staff.
  for (const factor of totp.filter((factor) => factor.status === "unverified")) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data: enrollment, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error || !enrollment) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <p className="text-danger">{t("startFailed")}</p>
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
