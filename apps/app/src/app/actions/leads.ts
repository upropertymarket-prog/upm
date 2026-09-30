"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import { leadStageUpdateSchema, type LeadStageUpdateInput } from "@upm/db/interaction";

/**
 * Leads do proprietário (P5-03) — 07 §18.2/§18.3.
 * =========================================================================
 * As leads nascem e avançam por trigger (primeira mensagem → `contacted`,
 * visita aceite → `visit`). A única escrita da aplicação é esta: fechar, ou
 * corrigir o estágio à mão. `outcome` é obrigatório ao fechar — validado aqui
 * e outra vez na função SQL, porque é a regra que distingue um negócio ganho
 * de um perdido e não pode depender do formulário.
 */

export type LeadActionState = { ok?: boolean; error?: string };

export async function updateLeadStage(input: LeadStageUpdateInput): Promise<LeadActionState> {
  const parsed = leadStageUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Estado inválido." };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("set_lead_stage", {
    p_lead_id: parsed.data.id,
    p_stage: parsed.data.stage,
    // A função SQL recebe `null` como "sem desfecho"; os tipos gerados escrevem
    // o argumento opcional como `undefined`, que é o mesmo do lado do Postgres.
    p_outcome: parsed.data.outcome ?? undefined,
  });
  if (error) return { error: error.message || "Não foi possível atualizar a lead." };

  revalidatePath("/leads");
  revalidatePath("/painel");
  return { ok: true };
}
