"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import { asPendingRole } from "@upm/db/pending";
import {
  appUpdateSaveSchema,
  archiveAppUpdate,
  deleteAppUpdate,
  publishAppUpdate,
  sanitizeUpdateBody,
  saveAppUpdate,
  updateBodyFindings,
} from "@upm/db/updates";

/**
 * As escritas das Atualizações (P10-07)
 * =========================================================================
 * **O papel verificado aqui é `marketing`, não `support`.** As Atualizações
 * saíram do Suporte a 13 out 2026 (07 §24.6) porque falam com um público e não
 * com uma pessoa que pediu ajuda. A função `security definer` repete a
 * verificação do seu lado (07 §20.5), e `is_staff()` **não** serve aqui — não
 * inclui o marketing, de propósito.
 *
 * O corpo é sanitizado antes de gravar, como as assinaturas e pela mesma razão
 * (02 §4.3): é HTML de um editor rico, e o que o mostra é um modal **dentro da
 * app autenticada de um cliente**.
 */

export type UpdateActionResult = {
  ok?: boolean;
  error?: string;
  notice?: string;
  id?: string;
  /** O que a sanitização retirou, para o ecrã o poder dizer. */
  removed?: string[];
};

async function getMarketingClient() {
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
  // `asPendingRole`: o enum gerado ainda não conhece `marketing` (D64).
  return asPendingRole(profile?.role) === "marketing" ? supabase : null;
}

/**
 * A imagem do modal de novidades (04 §8.1.3)
 * =========================================================================
 * O bucket `app-updates` é privado e aceita três formatos de imagem até 5 MB —
 * a mesma lista e o mesmo limite de `ticket-screenshots`, que é a referência
 * certa aqui: uma imagem de novidade é uma captura de ecrã da funcionalidade.
 *
 * O tipo decide-se pelos **primeiros bytes** e não pela extensão nem pelo
 * `type` que o browser declara (07 §19.8 #2): os dois são escritos por quem
 * carrega. A lista do bucket é a rede de segurança, não a porta.
 *
 * O caminho é `{profile_id}/{uuid}.{ext}`, como em `ticket-screenshots`: o
 * primeiro segmento é quem carregou, e é o que a policy de escrita lê.
 */
export async function uploadUpdateImage(
  formData: FormData,
): Promise<UpdateActionResult & { path?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha uma imagem." };
  if (file.size > 5 * 1024 * 1024) return { error: "A imagem excede 5 MB." };

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para carregar imagens." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageMime(bytes);
  if (!mime) return { error: "Só se aceitam imagens PNG, JPG e WebP." };

  const path = `${user.id}/${randomUUID()}.${mime.extension}`;
  const { error } = await supabase.storage
    .from("app-updates")
    .upload(path, bytes, { contentType: mime.type, upsert: false });

  if (error) return { error: "Não foi possível carregar a imagem." };

  // Devolve o caminho; é a gravação da atualização que o persiste. Uma imagem
  // carregada e não gravada fica no bucket sem referência — é o preço de não
  // obrigar a gravar antes de ver, e o bucket é varrido com os anexos quando
  // P10-10 tocar na Cloud interna.
  return { ok: true, path };
}

/** As assinaturas dos três formatos aceites, e a extensão de cada um. */
function sniffImageMime(bytes: Uint8Array): { type: string; extension: string } | null {
  const starts = (signature: number[]) => signature.every((byte, at) => bytes[at] === byte);

  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { type: "image/png", extension: "png" };
  }
  if (starts([0xff, 0xd8, 0xff])) return { type: "image/jpeg", extension: "jpg" };
  // WebP é RIFF com o tipo no 9.º byte.
  if (
    starts([0x52, 0x49, 0x46, 0x46]) &&
    [0x57, 0x45, 0x42, 0x50].every((byte, at) => bytes[8 + at] === byte)
  ) {
    return { type: "image/webp", extension: "webp" };
  }
  return null;
}

export async function saveUpdate(input: unknown): Promise<UpdateActionResult> {
  const parsed = appUpdateSaveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Atualização inválida." };
  }

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para editar atualizações." };

  const removed = updateBodyFindings(parsed.data.bodyHtml);
  const bodyHtml = sanitizeUpdateBody(parsed.data.bodyHtml);

  try {
    const id = await saveAppUpdate(supabase, { ...parsed.data, bodyHtml });
    revalidatePath("/marketing/atualizacoes");
    return {
      ok: true,
      id,
      removed,
      notice: removed.length > 0 ? "Guardado, com HTML inseguro retirado." : undefined,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    // Esta mensagem é a que resolve o problema de quem está a gravar: explica
    // que o caminho é arquivar e escrever outra.
    if (detail.includes("não se edita")) return { error: detail };
    if (detail.includes("já não existe")) {
      return { error: "Esta atualização já não existe — alguém a apagou." };
    }
    return { error: "Não foi possível guardar a atualização." };
  }
}

export async function publishUpdate(id: unknown): Promise<UpdateActionResult> {
  if (typeof id !== "string") return { error: "Pedido inválido." };

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para publicar atualizações." };

  try {
    await publishAppUpdate(supabase, id);
    revalidatePath("/marketing/atualizacoes");
    return { ok: true, notice: "Atualização publicada." };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    if (detail.includes("já está publicada"))
      return { error: "Esta atualização já está publicada." };
    if (detail.includes("arquivada")) {
      return { error: "Uma atualização arquivada não volta a ser publicada." };
    }
    return { error: "Não foi possível publicar a atualização." };
  }
}

export async function archiveUpdate(id: unknown): Promise<UpdateActionResult> {
  if (typeof id !== "string") return { error: "Pedido inválido." };

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para arquivar atualizações." };

  try {
    await archiveAppUpdate(supabase, id);
    revalidatePath("/marketing/atualizacoes");
    return { ok: true, notice: "Atualização arquivada — deixa de ser entregue." };
  } catch {
    return { error: "Não foi possível arquivar a atualização." };
  }
}

export async function removeUpdate(id: unknown): Promise<UpdateActionResult> {
  if (typeof id !== "string") return { error: "Pedido inválido." };

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para apagar atualizações." };

  try {
    await deleteAppUpdate(supabase, id);
    revalidatePath("/marketing/atualizacoes");
    return { ok: true, notice: "Atualização apagada." };
  } catch {
    // A função recusa apagar uma publicada: tem leitores, e o registo de quem a
    // leu desaparecia com ela pelo `on delete cascade`.
    return { error: "Só se apaga uma atualização que nunca foi publicada." };
  }
}
