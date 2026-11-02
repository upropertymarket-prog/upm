/**
 * Códigos TOTP para o percurso do staff
 * =========================================================================
 * O segredo lê-se do ecrã de configuração do 2FA, como um humano o leria
 * para o meter na app de autenticação. O código calcula-se com o mesmo
 * algoritmo (RFC 6238, 30 s, 6 dígitos).
 *
 * Um código já usado não se volta a aceitar dentro da mesma janela — é o que
 * impede que quem o espreitou o reutilize. Por isso, quando o teste precisa de
 * um segundo código, espera pela janela seguinte em vez de reenviar o mesmo.
 */
import { createClient } from "@supabase/supabase-js";
import { authenticator } from "otplib";

import { ANON_KEY, SUPABASE_URL } from "./ambiente";

export function codigo(segredo: string): string {
  return authenticator.generate(segredo.replace(/\s+/g, ""));
}

/** Um código diferente de `anterior` — espera pela janela seguinte se for preciso. */
export async function codigoNovo(segredo: string, anterior: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const atual = codigo(segredo);
    if (atual !== anterior) return atual;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("A janela TOTP não avançou em 40 s");
}

/**
 * Um fator TOTP **já verificado**, criado pela API — o estado de um membro da
 * equipa que configurou o 2FA há semanas. Devolve o segredo, para o teste
 * poder fazer de dono legítimo quando precisar.
 */
export async function fatorVerificado(email: string, palavraPasse: string): Promise<string> {
  const cliente = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const entrada = await cliente.auth.signInWithPassword({ email, password: palavraPasse });
  if (entrada.error) throw new Error(`Falha a entrar: ${entrada.error.message}`);
  const inscricao = await cliente.auth.mfa.enroll({ factorType: "totp" });
  if (inscricao.error || !inscricao.data)
    throw new Error(`Falha no enroll: ${inscricao.error?.message}`);
  const segredo = inscricao.data.totp.secret;
  const desafio = await cliente.auth.mfa.challenge({ factorId: inscricao.data.id });
  if (desafio.error || !desafio.data)
    throw new Error(`Falha no challenge: ${desafio.error?.message}`);
  const verificacao = await cliente.auth.mfa.verify({
    factorId: inscricao.data.id,
    challengeId: desafio.data.id,
    code: codigo(segredo),
  });
  if (verificacao.error) throw new Error(`Falha no verify: ${verificacao.error.message}`);
  await cliente.auth.signOut();
  return segredo;
}
