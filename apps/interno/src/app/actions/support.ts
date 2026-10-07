"use server";

import { cookies } from "next/headers";
import { createClient } from "@upm/db/server";
import { submitReport } from "@upm/db/support";

/**
 * Reportar problema — Server Action do interno (P10-01)
 * =========================================================================
 * A gémea de `apps/app/src/app/actions/support.ts`. O corpo está em
 * `@upm/db/support`; aqui fica só o `cookies()` → cliente.
 *
 * O staff também reporta problemas — e é quem mais os encontra. O ticket que
 * nasce daqui é igual a qualquer outro: `is_staff()` não dá privilégios à
 * entrada, só à leitura.
 */
export async function submitProblemReport(formData: FormData) {
  const supabase = createClient(await cookies());
  return submitReport(supabase, formData);
}
