"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import {
  createMailLabel,
  createTicketFromMail,
  discardMailDraft,
  getMailMessage,
  mailDraftSchema,
  mailFlagsSchema,
  mailLabelCreateSchema,
  mailLabelsSchema,
  mailMoveSchema,
  mailSendSchema,
  moveMail,
  saveMailDraft,
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
 * Gravar rascunho (P10-05). Chamada a cada pausa de escrita do composer, e por
 * isso devolve o `draftId`: a partir da segunda vez grava **por cima** do mesmo
 * rascunho em vez de deixar um rasto de cópias na pasta.
 */
export async function saveDraft(input: unknown): Promise<MailActionResult & { draftId?: string }> {
  const parsed = mailDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Rascunho inválido." };
  }

  const supabase = await getSupportClient();
  if (!supabase) return { error: "Sem permissão para escrever correio." };

  try {
    const draftId = await saveMailDraft(supabase, parsed.data);
    revalidatePath("/suporte/email");
    return { ok: true, draftId };
  } catch {
    return { error: "Não foi possível guardar o rascunho." };
  }
}

export async function discardDraft(draftId: unknown): Promise<MailActionResult> {
  if (typeof draftId !== "string") return { error: "Pedido inválido." };

  const supabase = await getSupportClient();
  if (!supabase) return { error: "Sem permissão para apagar rascunhos." };

  try {
    await discardMailDraft(supabase, draftId);
    revalidatePath("/suporte/email");
    return { ok: true };
  } catch {
    return { error: "Não foi possível apagar o rascunho." };
  }
}

/**
 * Enviar (P10-05).
 *
 * **A app não fala com o SMTP** — pede ao worker, que é quem tem a credencial,
 * e o worker só regista a mensagem como enviada depois de o servidor a aceitar.
 * A ordem é essa e não a inversa: uma caixa que mostra como enviado aquilo que
 * ficou pelo caminho diz a um cliente que lhe respondemos quando não
 * respondemos.
 */
export async function sendMail(input: unknown): Promise<MailActionResult> {
  const parsed = mailSendSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Mensagem inválida." };
  }

  const supabase = await getSupportClient();
  if (!supabase) return { error: "Sem permissão para enviar correio." };

  const workerUrl = process.env.MAIL_WORKER_URL;
  const workerToken = process.env.MAIL_WORKER_TOKEN;
  if (!workerUrl || !workerToken) {
    return { error: "O mail-worker ainda não está configurado (MAIL_WORKER_URL)." };
  }

  try {
    const response = await fetch(`${workerUrl.replace(/\/$/, "")}/send`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${workerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(45_000),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      return { error: body?.error ?? `O mail-worker respondeu ${response.status}.` };
    }

    revalidatePath("/suporte/email");
    return { ok: true, notice: "Mensagem enviada." };
  } catch {
    return { error: "Não foi possível falar com o mail-worker." };
  }
}

/**
 * "Sincronizar" — pede ao `mail-worker` uma passagem agora.
 *
 * O worker já sincroniza sozinho de cinco em cinco minutos; este botão existe
 * para quem está à espera de um e-mail concreto e não quer contar os minutos.
 * Como no teste de ligação, a app **não fala com o IMAP**: pede ao worker, que
 * é quem tem a credencial.
 */
export async function syncNow(): Promise<MailActionResult> {
  const supabase = await getSupportClient();
  if (!supabase) return { error: "Sem permissão para sincronizar o correio." };

  const workerUrl = process.env.MAIL_WORKER_URL;
  const workerToken = process.env.MAIL_WORKER_TOKEN;
  if (!workerUrl || !workerToken) {
    return { error: "O mail-worker ainda não está configurado (MAIL_WORKER_URL)." };
  }

  try {
    // Uma passagem por todas as caixas pode demorar: 60 s é o tempo de espera,
    // e não o tempo da sincronização — o worker continua depois disso.
    const response = await fetch(`${workerUrl.replace(/\/$/, "")}/sync`, {
      method: "POST",
      headers: { authorization: `Bearer ${workerToken}` },
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) return { error: `O mail-worker respondeu ${response.status}.` };

    const body = (await response.json().catch(() => null)) as {
      mailboxes?: { address: string; inserted: number; error?: string }[];
    } | null;

    const reports = body?.mailboxes ?? [];
    const failed = reports.filter((report) => report.error);
    const inserted = reports.reduce((total, report) => total + (report.inserted ?? 0), 0);

    revalidatePath("/suporte/email");

    if (failed.length > 0) {
      return { error: `${failed[0]!.address}: ${failed[0]!.error}` };
    }
    return {
      ok: true,
      notice: inserted > 0 ? `${inserted} mensagem(ns) nova(s).` : "Sem mensagens novas.",
    };
  } catch {
    return { error: "Não foi possível falar com o mail-worker." };
  }
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
