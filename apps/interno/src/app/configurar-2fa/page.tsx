import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";

import { AuthCard } from "../../components/AuthCard";
import { EnrollForm } from "./EnrollForm";

/**
 * Configurar a 2FA (07 §6).
 *
 * O render **não cria nem apaga fatores** (14 nov 2026). Criava-os — apagava o
 * fator por verificar e criava outro —, e cada re-render, incluindo o que vem
 * na resposta da Server Action de verificação, trocava o QR que a pessoa
 * acabara de ler: a app de autenticação ficava com um fator que já não
 * existia, e nenhum código passava. O fator nasce agora em `startEnrollment`,
 * chamado uma vez pelo formulário, e o QR fica no estado do cliente.
 *
 * Quem já tem a 2FA não chega cá — o middleware desvia-o —, e um código certo
 * redireciona para `/` dentro da própria action.
 */
export default async function SetupTwoFactorPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  return (
    <AuthCard>
      <EnrollForm />
    </AuthCard>
  );
}
