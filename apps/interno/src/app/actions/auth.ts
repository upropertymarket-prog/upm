"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@upm/db/server";

import { SESSION_COOKIES } from "../../lib/session";

/**
 * Terminar sessão em `interno` (07 §6).
 *
 * Sair daqui é mais do que esquecer o token do Supabase, porque a sessão de
 * `interno` tem três partes guardadas em sítios diferentes:
 *
 * 1. **O token** — `supabase.auth.signOut()`, que reescreve os cookies de
 *    sessão pelo mesmo caminho por onde o login os escreveu.
 * 2. **Os cookies próprios** (`lib/session.ts`) — a janela de 8h, a inatividade
 *    de 30 min e a prova de 2FA por código de recuperação. O middleware já os
 *    apaga quando a sessão expira; sair a pedido tem de os apagar também, senão
 *    a prova do segundo fator sobrevivia a quem saiu.
 * 3. **O step-up do PIN**, que **não** está na sessão: vive em
 *    `staff_auth.last_step_up_at`, na base de dados. Sem o limpar aqui, sair e
 *    voltar a entrar dentro de 15 minutos devolvia as ações sensíveis sem
 *    escrever o PIN — e um logout que deixa um privilégio de pé não é logout.
 *    A coluna só é escrevível por `service_role` desde P8-07, daí o cliente de
 *    serviço.
 *
 * A ordem importa: o step-up limpa-se **antes** do `signOut`, enquanto ainda há
 * um `user` de quem saber o id.
 */
export async function signOut(): Promise<void> {
  const store = await cookies();
  const supabase = createClient(store);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Falhar aqui não pode impedir a saída: a sessão acaba de qualquer forma, e
    // o pior caso é um step-up que caduca sozinho dentro de 15 min.
    try {
      await createServiceClient()
        .from("staff_auth")
        .update({ last_step_up_at: null })
        .eq("profile_id", user.id);
    } catch {
      // intencionalmente silencioso — ver acima.
    }
  }

  await supabase.auth.signOut();
  for (const name of SESSION_COOKIES) store.delete(name);

  redirect("/entrar");
}
