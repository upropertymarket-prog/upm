"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import {
  deleteSignature,
  inspectSignature,
  previewSignature,
  saveSignature,
  signatureSaveSchema,
  type SignatureFinding,
} from "@upm/db/signatures";

/**
 * As escritas do editor de assinaturas (P10-06)
 * =========================================================================
 * **A sanitização é aqui, e é a mesma coisa que o aviso do ecrã.** 02 §4.3
 * manda sanitizar no servidor, e `inspectSignature` devolve as duas metades de
 * uma vez: o que vai sair (os avisos) e o HTML limpo (o que se grava). O ecrã
 * chama a mesma função, pela action `inspect`, a cada pausa de escrita — e é
 * por isso que o aviso nunca diz uma coisa e a gravação faz outra.
 *
 * `email_signature_save()` recusa HTML inseguro do seu lado (07 §20.5). Não é
 * uma segunda sanitização — é a prova de que esta correu: se aquela exceção
 * disparar, existe um caminho de escrita que não passou por aqui.
 */

export type SignatureActionResult = { ok?: boolean; error?: string; notice?: string };

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
  // Só o Suporte: a assinatura é de quem responde ao cliente, e 07 §24.6 #3
  // põe-na no Suporte — o marketing lê-a nas campanhas e não a edita.
  return profile?.role === "support" ? supabase : null;
}

export async function saveSignatureAction(
  input: unknown,
): Promise<SignatureActionResult & { id?: string; findings?: SignatureFinding[] }> {
  const parsed = signatureSaveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Assinatura inválida." };
  }

  const supabase = await getSupportClient();
  if (!supabase) return { error: "Sem permissão para editar assinaturas." };

  // Grava-se o **limpo**, nunca o que veio. Os avisos voltam com a resposta
  // para o ecrã poder dizer o que foi retirado — o sanitizador tira em
  // silêncio, e um silêncio aqui é uma assinatura que não ficou como se viu.
  const { clean, findings } = inspectSignature(parsed.data.html);

  try {
    const id = await saveSignature(supabase, { ...parsed.data, html: clean });
    revalidatePath("/suporte/assinaturas");
    // A assinatura entra no composer da caixa associada: sem isto, a caixa
    // continuava a inserir a versão anterior até alguém recarregar.
    revalidatePath("/suporte/email");

    const removed = findings.filter((finding) => finding.kind === "unsafe").length;
    return {
      ok: true,
      id,
      findings,
      notice: removed > 0 ? "Assinatura guardada, com HTML inseguro retirado." : undefined,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    // A mensagem desta vem com os endereços das caixas em causa, e é a única
    // informação que resolve o problema de quem está a gravar.
    if (detail.includes("já têm assinatura")) return { error: detail };
    if (detail.includes("já não existe")) {
      return { error: "Esta assinatura já não existe — alguém a apagou." };
    }
    return { error: "Não foi possível guardar a assinatura." };
  }
}

export async function deleteSignatureAction(id: unknown): Promise<SignatureActionResult> {
  if (typeof id !== "string") return { error: "Pedido inválido." };

  const supabase = await getSupportClient();
  if (!supabase) return { error: "Sem permissão para apagar assinaturas." };

  try {
    await deleteSignature(supabase, id);
    revalidatePath("/suporte/assinaturas");
    revalidatePath("/suporte/email");
    return { ok: true, notice: "Assinatura apagada." };
  } catch {
    return { error: "Não foi possível apagar a assinatura." };
  }
}

const inspectInput = z.object({
  html: z.string().max(200_000),
  mailboxId: z.string().uuid().nullish(),
});

/**
 * Os avisos e a pré-visualização, numa ida só
 * =========================================================================
 * Chamada pelo editor a cada pausa de escrita. Devolve as três coisas que o
 * ecrã mostra: o que vai ser retirado, que variáveis não existem, e o HTML
 * limpo **já com as variáveis resolvidas** para a caixa escolhida.
 *
 * Porque é que isto não corre no cliente: o sanitizador é o que decide o que
 * sai, e tê-lo em dois sítios é tê-lo a divergir. A resolução das variáveis é
 * da base de dados, pela mesma razão (05 §1.8). Uma pausa de escrita é um
 * pedido; é mais barato do que um aviso que mente.
 */
export async function inspectSignatureAction(input: unknown): Promise<{
  findings: SignatureFinding[];
  preview: string;
  variables: string[];
  error?: string;
}> {
  const parsed = inspectInput.safeParse(input);
  if (!parsed.success)
    return { findings: [], preview: "", variables: [], error: "Pedido inválido." };

  const supabase = await getSupportClient();
  if (!supabase) {
    return { findings: [], preview: "", variables: [], error: "Sem permissão." };
  }

  const { findings, clean, variables } = inspectSignature(parsed.data.html);
  const preview = parsed.data.mailboxId
    ? await previewSignature(supabase, { html: clean, mailboxId: parsed.data.mailboxId })
    : clean;

  return { findings, preview, variables };
}
