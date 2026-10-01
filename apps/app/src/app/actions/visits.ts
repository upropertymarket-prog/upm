"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import { planLimitMessage } from "@upm/db/billing";
import {
  rescheduleSchema,
  toProposedAt,
  visitRequestSchema,
  type RescheduleInput,
  type VisitRequestInput,
} from "@upm/db/interaction";

/**
 * Pedidos de visita e agenda (P5-02) — 03 F6, 07 §1.2, 07 §5.6.
 * =========================================================================
 * Cada transição é uma função `security definer` da migração: é lá que vive o
 * invariante que a aplicação não pode partir — aceitar cria o grant de morada
 * na mesma transação (07 §1.2.4), e o reagendamento valida limite e alternância
 * (07 §5.6). Aqui só se valida o input e se traduz o erro do Postgres.
 */

export type VisitActionState = { ok?: boolean; error?: string };

/**
 * O Postgres devolve a mensagem da função; é ela que explica ao utilizador
 * porque não pode reagendar outra vez. Traduzir para "algo correu mal" perdia
 * exatamente a informação útil.
 */
function toMessage(error: { message?: string } | null, fallback: string): string {
  const message = error?.message?.trim();
  return message && !message.startsWith("invalid input") ? message : fallback;
}

function paths() {
  revalidatePath("/agenda");
  revalidatePath("/meus-pedidos");
  revalidatePath("/painel");
}

/** 03 F6 passo 1 — modal "Pedir visita" (04 §8.4). Fecha metade de D20. */
export async function requestVisit(input: VisitRequestInput): Promise<VisitActionState> {
  const parsed = visitRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Pedido inválido." };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("request_visit", {
    p_property_id: parsed.data.property_id,
    p_proposed_at: toProposedAt(parsed.data.date, parsed.data.time),
    p_message: parsed.data.message,
  });
  if (error) {
    return {
      error: planLimitMessage(error) ?? toMessage(error, "Não foi possível pedir a visita."),
    };
  }

  paths();
  return { ok: true };
}

/**
 * 07 §1.2.3/§1.2.4 — aceitar partilha a morada exata com este comprador. O
 * modal de confirmação que diz isso em voz alta vive no componente; aqui é o
 * lado servidor da mesma decisão.
 */
export async function acceptVisit(id: string): Promise<VisitActionState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("accept_visit_request", { p_id: id });
  if (error) return { error: toMessage(error, "Não foi possível aceitar a visita.") };

  paths();
  return { ok: true };
}

export async function rescheduleVisit(input: RescheduleInput): Promise<VisitActionState> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data inválida." };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("reschedule_visit_request", {
    p_id: parsed.data.id,
    p_proposed_at: toProposedAt(parsed.data.date, parsed.data.time),
  });
  if (error) return { error: toMessage(error, "Não foi possível reagendar a visita.") };

  paths();
  return { ok: true };
}

export async function cancelVisit(id: string): Promise<VisitActionState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("cancel_visit_request", { p_id: id });
  if (error) return { error: toMessage(error, "Não foi possível cancelar a visita.") };

  paths();
  return { ok: true };
}

/** 07 §5.6 — arquivar é manual, a partir de `completed` ou `cancelled`. */
export async function archiveVisit(id: string): Promise<VisitActionState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("archive_visit_request", { p_id: id });
  if (error) return { error: toMessage(error, "Não foi possível arquivar a visita.") };

  paths();
  return { ok: true };
}
