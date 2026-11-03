"use server";

import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@upm/db/server";
import {
  checkAuthRateLimit,
  hashPin,
  markStepUp,
  pinSchema,
  recordAuthAttempt,
  verifyPin,
} from "@upm/db/auth";

import type { StepUpState } from "../../components/stepUpTypes";

/**
 * Step-up do PIN de operação — P8-07 (07 §6, decisão em 07 §21.1)
 * =========================================================================
 * Confirma o PIN e concede 15 minutos para as ações sensíveis do `interno`.
 *
 * Três coisas que não são detalhe:
 *
 * 1. **A mensagem de erro é sempre a mesma.** PIN errado, PIN por definir,
 *    conta sem registo de staff e limite de tentativas excedido dão a mesma
 *    resposta. Distinguir os casos diria a quem adivinha se vale a pena
 *    continuar — a regra que 07 §19.14 fixou para as ligações de partilha, e
 *    que 08 §7.6 exige para a enumeração de contas.
 * 2. **A concessão é escrita com `service_role`.** `last_step_up_at` deixou de
 *    ser escrevível por `authenticated` em P8-07, e `mark_step_up` só tem
 *    `execute` para `service_role`. Sem isso, bastava um `update` pelo
 *    PostgREST para ter step-up sem escrever o PIN.
 * 3. **O tempo de resposta não revela se há PIN definido.** Sem hash guardada,
 *    a verificação corre contra uma hash chamariz, com o mesmo custo de Argon2.
 */

export type { StepUpState } from "../../components/stepUpTypes";

/** Uma só mensagem para todos os caminhos de falha — ver nota 1. */
const GENERIC_ERROR = "Não foi possível confirmar o PIN.";

/**
 * Hash de uma PIN que não é a de ninguém, calculada à primeira necessidade e
 * reutilizada. Serve só para gastar o mesmo tempo de Argon2 quando a conta não
 * tem PIN definido (nota 3).
 */
let decoyHash: Promise<string> | null = null;
function timingDecoy(): Promise<string> {
  decoyHash ??= hashPin("000000");
  return decoyHash;
}

export async function verifyOperationPin(
  _prev: StepUpState,
  formData: FormData,
): Promise<StepUpState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: GENERIC_ERROR };

  // 08 §3.2 — papel verificado no servidor, não herdado do facto de a página
  // ter carregado. O middleware já o fez; esta é a segunda fechadura.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "support") {
    return { error: GENERIC_ERROR };
  }

  // 08 §5.5 — bloqueio progressivo, pelo mesmo mecanismo do login (07 §9.1).
  const rateLimit = await checkAuthRateLimit(user.id, "pin_verify");
  if (!rateLimit.allowed) {
    return { error: GENERIC_ERROR, retryAfterSeconds: rateLimit.retryAfterSeconds };
  }

  const parsed = pinSchema.safeParse(formData.get("pin"));
  if (!parsed.success) {
    await recordAuthAttempt(user.id, "pin_verify", false);
    return { error: GENERIC_ERROR };
  }

  const { data: row } = await supabase
    .from("staff_auth")
    .select("pin_hash")
    .eq("profile_id", user.id)
    .maybeSingle();

  const matched = await verifyPin(parsed.data, row?.pin_hash ?? (await timingDecoy()));
  const ok = matched && Boolean(row?.pin_hash);
  await recordAuthAttempt(user.id, "pin_verify", ok);
  if (!ok) return { error: GENERIC_ERROR };

  try {
    await markStepUp(createServiceClient(), user.id);
  } catch {
    // Falta de `SUPABASE_SERVICE_ROLE_KEY` ou linha de `staff_auth` inexistente.
    // Não se concede step-up por omissão — a ação sensível fica bloqueada, que
    // é o lado seguro de falhar.
    return { error: GENERIC_ERROR };
  }

  return { ok: true };
}
