import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { pendingRpc } from "./pending-types";

/**
 * Subscrição: compromisso e cancelamento (Fase 9, P9-03 e P9-04)
 * =========================================================================
 * **A decisão de cancelar vive numa só porta, e a porta é SQL.**
 * `can_cancel_subscription()` é quem decide; `canCancelSubscription()` aqui é
 * o único caminho da aplicação até ela. Nenhum ecrã, nenhuma Server Action e
 * nenhum componente repete a regra — é por isso que esta função não tem lógica
 * nenhuma dentro: se tivesse, passavam a existir duas respostas possíveis.
 *
 * Porque é que a decisão é SQL e não TypeScript: a mesma razão de 07 §20.5. Uma
 * verificação em TypeScript vale enquanto a Server Action for o único caminho
 * até à tabela — e há três apps, há RPC, e amanhã há mais uma action.
 *
 * **Nenhum período mínimo está definido** (decisão do cliente, 7 out 2026).
 * Hoje `allowed` é sempre verdadeiro; o que esta camada tem de garantir é que,
 * no dia em que deixar de ser, ninguém tenha de procurar a regra em dois
 * sítios.
 */

type AnySupabaseClient = SupabaseClient<Database>;

/**
 * Os modos que a porta está preparada para devolver. `after_commitment` e
 * `blocked` existem para quando houver período mínimo; não são usados hoje.
 */
export const CANCEL_MODES = [
  "end_of_period",
  "immediate",
  "after_commitment",
  "blocked",
  "already_requested",
  "already_canceled",
] as const;
export type CancelMode = (typeof CANCEL_MODES)[number];

export type CancelDecision = {
  allowed: boolean;
  mode: CancelMode;
  reasonCode: string | null;
  /** Quando o cancelamento produz efeitos. `null` = não se sabe o fim do período. */
  effectiveAt: string | null;
  /** Até quando está impedido. `null` = não está. */
  blockedUntil: string | null;
  /** `null` = nenhum compromisso definido; `0` = definido como nenhum. */
  commitmentMonths: number | null;
  commitmentEndsAt: string | null;
};

function toDecision(raw: Record<string, unknown>): CancelDecision {
  return {
    allowed: raw.allowed === true,
    mode: (raw.mode as CancelMode) ?? "end_of_period",
    reasonCode: (raw.reason_code as string | null) ?? null,
    effectiveAt: (raw.effective_at as string | null) ?? null,
    blockedUntil: (raw.blocked_until as string | null) ?? null,
    commitmentMonths: (raw.commitment_months as number | null) ?? null,
    commitmentEndsAt: (raw.commitment_ends_at as string | null) ?? null,
  };
}

/**
 * A única pergunta "posso cancelar?" da aplicação.
 *
 * Devolve `null` quando a resposta não pôde ser obtida (sem sessão, subscrição
 * de outra pessoa, rede em baixo). Quem chama trata `null` como "não mostres o
 * botão", nunca como "pode" — falhar fechado é o lado certo aqui.
 */
export async function canCancelSubscription(
  supabase: AnySupabaseClient,
  subscriptionId: string,
): Promise<CancelDecision | null> {
  // `pendingRpc` enquanto os tipos não forem regenerados — ver pending-types.ts.
  const { data, error } = await pendingRpc<Record<string, unknown>>(
    supabase,
    "can_cancel_subscription",
    { p_subscription_id: subscriptionId },
  );
  if (error || !data || typeof data !== "object") return null;
  return toDecision(data);
}

/**
 * O motivo é opcional — exigi-lo transformava o cancelamento em obstáculo, e
 * P9-04 é explícito: nenhum bloqueio nesta fase.
 */
export const cancelReasonSchema = z
  .string()
  .trim()
  .max(1000, "Máximo 1000 caracteres")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

/**
 * Compromisso mínimo, para a interface. **`null` não é zero**: `null` é
 * "não existe período mínimo definido" e `0` é "definido como nenhum". Os dois
 * mostram-se da mesma maneira ao utilizador — a ausência — mas significam
 * coisas diferentes para quem configurar isto depois (P9-03).
 */
export function hasCommitment(months: number | null | undefined): boolean {
  return typeof months === "number" && months > 0;
}

/**
 * P9-09: "enquanto o compromisso não estiver decidido, não se mostra número
 * nenhum — mostra-se a ausência dele". Esta função devolve `null` quando não
 * há, e é a ausência que o ecrã rende — nunca um `0` nem um `—` a fingir.
 */
export function commitmentMonths(months: number | null | undefined): number | null {
  return hasCommitment(months) ? (months as number) : null;
}
