"use server";

import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import { registerStaffCloudFile } from "@upm/db/cloud";
import {
  createMailLabel,
  createTicketFromMail,
  discardMailDraft,
  getMailMessage,
  mailAttachmentSchema,
  mailAttachmentsOf,
  mailDraftSchema,
  mailFlagsSchema,
  mailLabelCreateSchema,
  mailLabelsSchema,
  mailMoveSchema,
  mailSendSchema,
  markMailAttachmentSaved,
  moveMail,
  saveMailDraft,
  setMailFlags,
  setMailLabels,
} from "@upm/db/mail";
import { MAIL_ATTACHMENT_BUCKET } from "@upm/db/mail-attachments";

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

/**
 * `download` guarda o ficheiro com o nome original; `view` abre-o no
 * visualizador do browser, que é o que a impressão precisa. Fica aqui e não em
 * `@upm/db/mail` porque é uma decisão do ecrã — a base de dados não sabe o que
 * é um `Content-Disposition`.
 */
const mailAttachmentModeSchema = z.enum(["download", "view"]);

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

// ---------------------------------------------------------------------------
// Anexos (D66)
// ---------------------------------------------------------------------------

/**
 * O URL assinado de um anexo — Transferir e Imprimir
 * =========================================================================
 * **O URL é assinado com a sessão de quem o pede**, e não com a chave de
 * serviço: a policy `mail_attachments_staff_select` é avaliada no momento da
 * assinatura, e por isso quem não é staff não consegue sequer obter o link. É o
 * mesmo caminho das fotos dos imóveis desde a Fase 4.
 *
 * Dois minutos de validade. Não é por desconfiança de quem pede — é porque um
 * URL assinado é uma chave anónima enquanto durar, e um anexo de suporte traz
 * frequentemente dados de um cliente: contrato, caderneta predial, recibo. O
 * tempo que precisa de viver é o de um clique.
 *
 * `mode` decide o `Content-Disposition`: `download` manda o browser guardar o
 * ficheiro com o nome original, `view` deixa-o abrir no visualizador. O segundo
 * é o que a impressão usa.
 */
export async function attachmentLink(
  input: unknown,
): Promise<MailActionResult & { url?: string; filename?: string; contentType?: string }> {
  const parsed = mailAttachmentSchema.extend({ mode: mailAttachmentModeSchema }).safeParse(input);
  if (!parsed.success) return { error: "Pedido inválido." };

  const supabase = await getSupportClient();
  if (!supabase) return { error: "Sem permissão para abrir anexos." };

  const message = await getMailMessage(supabase, parsed.data.messageId);
  if (!message) return { error: "Mensagem inexistente." };

  const file = mailAttachmentsOf(message)[parsed.data.index];
  if (!file) return { error: "Anexo inexistente." };
  if (!file.path) return { error: "Este anexo não tem conteúdo guardado." };

  const { data, error } = await supabase.storage
    .from(MAIL_ATTACHMENT_BUCKET)
    .createSignedUrl(file.path, 120, {
      download: parsed.data.mode === "download" ? file.filename : undefined,
    });

  if (error || !data?.signedUrl) return { error: "Não foi possível abrir o anexo." };
  return { ok: true, url: data.signedUrl, filename: file.filename, contentType: file.contentType };
}

/**
 * "Guardar na Cloud" — a cópia para a Cloud interna
 * =========================================================================
 * É uma **cópia**, e não uma referência. A alternativa — apontar a linha de
 * `files` para o bucket `mail-attachments` — parecia mais limpa e era pior: os
 * bytes do bucket do correio expiram aos 180 dias (decisão do cliente), e a
 * Cloud ficaria com um ficheiro que desaparecia sozinho meio ano depois de
 * alguém o ter guardado exatamente para não o perder.
 *
 * Fica com `scope = 'staff'`, que existe desde a Fase 6 (`20260930120000`) à
 * espera da Cloud interna, e `source = 'mail_attachment'`, que é novo: o anexo
 * do chat (`message_attachment`) é outra conversa com outra pessoa, e misturá-los
 * faria os relatórios de P10-10 contar as duas coisas na mesma linha.
 *
 * A ordem é a de `uploadFile` na Cloud do cliente: objeto primeiro, registo
 * depois, e se o registo recusar o objeto sai. Um ficheiro no bucket que nenhuma
 * linha referencia é espaço que ninguém contabiliza.
 */
export async function attachmentToCloud(input: unknown): Promise<MailActionResult> {
  const parsed = mailAttachmentSchema.safeParse(input);
  if (!parsed.success) return { error: "Pedido inválido." };

  const supabase = await getSupportClient();
  if (!supabase) return { error: "Sem permissão para guardar anexos." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const message = await getMailMessage(supabase, parsed.data.messageId);
  if (!message) return { error: "Mensagem inexistente." };

  const file = mailAttachmentsOf(message)[parsed.data.index];
  if (!file) return { error: "Anexo inexistente." };
  if (!file.path) return { error: "Este anexo não tem conteúdo guardado." };
  if (file.cloudFileId) return { error: "Este anexo já está na Cloud interna." };

  const download = await supabase.storage.from(MAIL_ATTACHMENT_BUCKET).download(file.path);
  if (download.error || !download.data) return { error: "Não foi possível ler o anexo." };

  const bytes = new Uint8Array(await download.data.arrayBuffer());
  const storagePath = `${user.id}/${randomUUID()}/1`;

  const upload = await supabase.storage
    .from("cloud")
    .upload(storagePath, bytes, { contentType: file.contentType, upsert: false });
  if (upload.error) return { error: "Não foi possível guardar na Cloud." };

  let fileId: string | null = null;
  try {
    fileId = await registerStaffCloudFile(supabase, {
      name: file.filename.slice(0, 200),
      mime: file.contentType,
      size: bytes.byteLength,
      storagePath,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      source: "mail_attachment",
    });

    await markMailAttachmentSaved(supabase, { ...parsed.data, fileId });
  } catch (error) {
    // Desfaz pela ordem inversa: a linha e, com ela, as versões por cascade; e
    // depois o objeto. É o caso raro de dois turnos a guardar o mesmo anexo ao
    // mesmo tempo — a função recusa o segundo, e o segundo não deixa restos.
    if (fileId) await supabase.from("files").delete().eq("id", fileId);
    await supabase.storage.from("cloud").remove([storagePath]);

    const detail = error instanceof Error ? error.message : "";
    if (detail.includes("já está na Cloud")) {
      return { error: "Este anexo já está na Cloud interna." };
    }
    return { error: "Não foi possível guardar na Cloud." };
  }

  revalidatePath("/suporte/email");
  return { ok: true, notice: "Anexo guardado na Cloud interna." };
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
