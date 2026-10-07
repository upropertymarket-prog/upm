"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import { setTicketStatus, ticketStatusSchema } from "@upm/db/support";

/**
 * Workflow de tickets — Server Actions (P10-02)
 * =========================================================================
 * Uma só: "Guardar e notificar" de 04 §2.6. Guardar o estado e avisar quem
 * reportou são **o mesmo ato** e não dois botões — foi assim que o doc o
 * escreveu, e é a leitura certa: um estado que muda sem a pessoa saber é uma
 * promessa quebrada (04 §2.7 #5). A notificação parte de dentro de
 * `set_ticket_status`, não daqui, para que nenhum outro caminho até ao estado
 * a possa saltar.
 *
 * A verificação de papel não está aqui: está na função SQL **e** na policy.
 * É deliberado — 07 §20.5. Repeti-la nesta action dava a ilusão de que é esta
 * a camada que decide.
 */
export type TicketActionResult = { ok?: true; error?: string };

export async function saveTicketStatus(input: unknown): Promise<TicketActionResult> {
  const parsed = ticketStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Pedido inválido." };
  }

  const supabase = createClient(await cookies());
  const result = await setTicketStatus(supabase, parsed.data);
  if ("error" in result) return result;

  revalidatePath("/suporte/tickets");
  // O KPI "bugs abertos" do Painel do Admin lê o mesmo número (D48).
  revalidatePath("/admin/painel");
  revalidatePath("/admin/tickets");
  return { ok: true };
}
