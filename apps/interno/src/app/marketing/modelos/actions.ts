"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import { writeAuditLog } from "@upm/db/audit";
import {
  deleteTemplate,
  sanitizeTemplateHtml,
  saveTemplate,
  templateFindings,
  templateSaveSchema,
  type TemplateSaveInput,
} from "@upm/db/message-templates";

/**
 * Modelos de e-mail — escrita (21 out 2026)
 * =========================================================================
 * Irmã de `atualizacoes/actions.ts` e de `assinaturas/actions.ts`, com as
 * mesmas três decisões:
 *
 * 1. **O papel verifica-se dos dois lados.** Aqui, para dar uma mensagem útil;
 *    e dentro de `template_save`, que é `security definer` e por isso tem de se
 *    defender sozinha de quem chame o RPC diretamente.
 * 2. **O HTML é sanitizado antes de ir para a base de dados** — é o último
 *    ponto por onde o conteúdo passa (02 §4.3), e o que sai daqui vai ser
 *    desenhado no painel interno e inserido no compositor de e-mail.
 * 3. **O que a sanitização retirou é dito ao utilizador**, em vez de
 *    desaparecer em silêncio: quem colou um bloco de outro sítio tem de saber
 *    que metade dele não ficou.
 */

export type TemplateActionResult = { ok?: boolean; id?: string; error?: string; notice?: string };

/**
 * O cliente de quem pode escrever modelos: Marketing ou Admin.
 *
 * O Suporte lê — é para ele que os modelos existem — mas não escreve. Se
 * pudesse, o "texto aprovado" deixava de o ser à primeira pressa.
 */
async function getWriterClient() {
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

  const role = profile?.role ?? null;
  return role === "marketing" || role === "admin" ? supabase : null;
}

export async function saveTemplateAction(input: TemplateSaveInput): Promise<TemplateActionResult> {
  const parsed = templateSaveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados do modelo inválidos." };
  }

  const supabase = await getWriterClient();
  if (!supabase) return { error: "Sem permissão para escrever modelos." };

  const bodyHtml = sanitizeTemplateHtml(parsed.data.bodyHtml);
  const removed = templateFindings(parsed.data.bodyHtml);

  let id: string;
  try {
    id = await saveTemplate(supabase, { ...parsed.data, bodyHtml });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not_authorized")) return { error: "Sem permissão." };
    if (message.includes("name_required")) return { error: "O nome do modelo é obrigatório." };
    return { error: "Não foi possível guardar o modelo." };
  }

  // O rasto, como nas Atualizações e no SEO: um modelo é texto que vai sair em
  // nome da empresa, e quem o alterou interessa. A falha do registo não desfaz
  // a gravação — mas também não se cala.
  let notice: string | undefined;
  try {
    await writeAuditLog(supabase, {
      action: parsed.data.id ? "template.updated" : "template.created",
      entity: "message_templates",
      entityId: id,
      diff: { name: parsed.data.name, category: parsed.data.category },
    });
  } catch {
    notice = "Guardado, mas o registo de auditoria falhou — avise a administração.";
  }

  if (removed.length > 0) {
    notice = `Guardado. Foi removido do corpo: ${removed.join(", ")}.`;
  }

  revalidatePath("/marketing/modelos");
  return { ok: true, id, notice };
}

export async function deleteTemplateAction(id: string): Promise<TemplateActionResult> {
  const supabase = await getWriterClient();
  if (!supabase) return { error: "Sem permissão para apagar modelos." };

  try {
    await deleteTemplate(supabase, id);
  } catch {
    return { error: "Não foi possível apagar o modelo." };
  }

  try {
    await writeAuditLog(supabase, {
      action: "template.deleted",
      entity: "message_templates",
      entityId: id,
      diff: null,
    });
  } catch {
    // Ver a nota em `saveTemplateAction`.
  }

  revalidatePath("/marketing/modelos");
  return { ok: true };
}
