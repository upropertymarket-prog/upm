"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import {
  createMailLabel,
  createTicketFromMail,
  getMailMessage,
  mailFlagsSchema,
  mailLabelCreateSchema,
  mailLabelsSchema,
  mailMoveSchema,
  moveMail,
  setMailFlags,
  setMailLabels,
} from "@upm/db/mail";

/**
 * As escritas da Caixa de e-mail (P10-04)
 * =========================================================================
 * Cada action embrulha uma das funções `security definer` de
 * `20261013120000_mail_actions.sql`. **A verificação de papel está nos dois
 * lados** — aqui, para dar uma mensagem útil, e lá dentro, porque uma função
 * definer passa por cima da RLS e tem de se defender de quem chame o RPC
 * diretamente (07 §20.5).
 *
 * `toggleMailLabel` é a única que lê antes de escrever: a função da base de
 * dados recebe o **conjunto** de marcadores, não um `adicionar`/`remover`. É
 * assim de propósito — um `adicionar` concorrente com um `remover` deixaria a
 * lista por metade, e com o conjunto inteiro a última escrita é a que fica.
 */

export type MailActionResult = { ok?: boolean; error?: string; notice?: string };

async function getSupportClient() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  // Só o Suporte: `/admin/tickets` é de leitura e a caixa do Admin é a de
  // configuração, não esta (07 §5.10 · 07 §24.6).
  return profile?.role === "support" ? supabase : null;
}

export async function setFlags(input: unknown): Promise<MailActionResult> {
  const parsed = mailFlagsSchema.safeParse(input);
  if (!parsed.success) return { error: "Pedido inválido." };

  const supabase = await getSupportClient();
  if (!supabase) return { error: "Sem permissão para alterar o correio." };

  try {
    await setMailFlags(supabase, parsed.data);
  } catch {
    return { error: "Não foi possível atualizar a mensagem." };
  }

  revalidatePath("/suporte/email");
  return { ok: true };
}

export async function moveMessage(input: unknown): Promise<MailActionResult> {
  const parsed = mailMoveSchema.safeParse(input);
  if (!parsed.success) return { error: "Pedido inválido." };

  const supabase = await getSupportClient();
  if (!supabase) return { error: "Sem permissão para arquivar correio." };

  try {
    await moveMail(supabase, parsed.data);
  } catch {
    return { error: "Não foi possível mover a mensagem." };
  }

  revalidatePath("/suporte/email");
  return { ok: true };
}

export async function addLabel(input: unknown): Promise<MailActionResult> {
  const parsed = mailLabelCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Marcador inválido." };
  }

  const supabase = await getSupportClient();
  if (!supabase) return { error: "Sem permissão para criar marcadores." };

  try {
    await createMailLabel(supabase, parsed.data);
  } catch (error) {
    // 23505 é o índice único por caixa: dois marcadores "Urgente" na mesma
    // caixa seriam dois filtros indistinguíveis.
    const message = error instanceof Error ? error.message : "";
    if (message.includes("duplicate key")) return { error: "Já existe um marcador com este nome." };
    return { error: "Não foi possível criar o marcador." };
  }

  revalidatePath("/suporte/email");
  return { ok: true };
}

/** Liga ou desliga um marcador, enviando sempre o conjunto completo. */
export async function toggleMailLabel(input: unknown): Promise<MailActionResult> {
  const parsed = mailLabelsSchema
    .omit({ labelIds: true })
    .extend({ labelId: mailLabelsSchema.shape.labelIds.element })
    .safeParse(input);
  if (!parsed.success) return { error: "Pedido inválido." };

  const supabase = await getSupportClient();
  if (!supabase) return { error: "Sem permissão para etiquetar correio." };

  const message = await getMailMessage(supabase, parsed.data.messageId);
  if (!message) return { error: "Mensagem inexistente." };

  const current = new Set(message.labels);
  if (current.has(parsed.data.labelId)) current.delete(parsed.data.labelId);
  else current.add(parsed.data.labelId);

  try {
    await setMailLabels(supabase, {
      messageId: parsed.data.messageId,
      labelIds: [...current],
    });
  } catch {
    return { error: "Não foi possível alterar os marcadores." };
  }

  revalidatePath("/suporte/email");
  return { ok: true };
}

/**
 * "Criar ticket" (04 §2.5). Idempotente: a função devolve o ticket existente
 * quando a mensagem já tem um, e o ecrã diz "Abrir ticket" nesse caso.
 */
export async function ticketFromMail(messageId: unknown): Promise<MailActionResult> {
  if (typeof messageId !== "string") return { error: "Pedido inválido." };

  const supabase = await getSupportClient();
  if (!supabase) return { error: "Sem permissão para criar tickets." };

  try {
    const ticket = await createTicketFromMail(supabase, messageId);
    revalidatePath("/suporte/email");
    revalidatePath("/suporte/tickets");
    return {
      ok: true,
      notice: ticket.created
        ? `Ticket ${ticket.ref} criado.`
        : `Esta mensagem já é o ${ticket.ref}.`,
    };
  } catch {
    return { error: "Não foi possível criar o ticket." };
  }
}
