"use server";

import { cookies } from "next/headers";
import { createClient } from "@upm/db/server";
import { submitReport } from "@upm/db/support";

/**
 * Reportar problema — Server Action (P10-01)
 * =========================================================================
 * Fina de propósito: a validação, o upload da captura e o cálculo do
 * `fingerprint` vivem em `@upm/db/support`, partilhados com `apps/interno`.
 * Duas apps a validar o mesmo relato de duas maneiras é o mesmo que não o
 * validar.
 *
 * O cliente é o da **sessão**, nunca o de serviço: é `auth.uid()` dentro de
 * `report_problem()` que decide quem é o reporter, e com a chave de serviço o
 * reporter passaria a ser escolhido pelo pedido.
 */
export async function submitProblemReport(formData: FormData) {
  const supabase = createClient(await cookies());
  return submitReport(supabase, formData);
}
