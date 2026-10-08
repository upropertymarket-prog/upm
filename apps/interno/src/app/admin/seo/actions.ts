"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import { writeAuditLog } from "@upm/db/audit";

/**
 * Gravação do SEO por rota (P2-06 2.ª metade · 07 §24.5)
 * =========================================================================
 * Uma action só, porque só há uma operação: guardar o que o Admin escreveu
 * para uma rota. Apagar não é um botão à parte — limpar todos os campos é
 * dizer "volta ao ficheiro", e é a função SQL que apaga a linha nesse caso.
 *
 * **A verificação de papel está nos dois lados**, como em todas as mutações
 * deste projeto: aqui, para dar uma mensagem útil, e dentro de
 * `admin_save_seo_page`, que é `security definer` e por isso tem de se
 * defender sozinha de quem chame o RPC diretamente.
 *
 * Os limites de 60 e 160 caracteres **não** são validados aqui. São conselho de
 * SEO, não regra: um título a 62 caracteres é truncado pelo Google, não é
 * inválido, e recusá-lo tiraria ao marketing uma decisão que é dele. O editor
 * mostra o contador a vermelho e o `check-seo` avisa — as duas formas certas de
 * o dizer. O que se valida é o que nunca é intencional: uma rota mal formada,
 * um canonical que não é um URL absoluto, um campo absurdamente longo.
 */

const optionalText = (max: number) => z.string().trim().max(max).optional();

const saveSchema = z.object({
  route: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .refine((value) => value === "*" || /^\/\S*$/.test(value), {
      message: "A rota tem de começar por / (ou ser * para as predefinições).",
    }),
  titleTag: optionalText(200),
  metaDescription: optionalText(400),
  ogSameAsPage: z.boolean().optional(),
  ogTitle: optionalText(200),
  ogDescription: optionalText(400),
  ogImage: optionalText(500).refine((value) => !value || /^(\/|https?:\/\/)/.test(value), {
    message: "A imagem tem de ser um caminho em /public ou um URL absoluto.",
  }),
  ogImageAlt: optionalText(300),
  // Absoluto e não relativo: um canonical relativo é interpretado contra o
  // domínio de quem o lê, e numa partilha isso aponta para o sítio errado.
  canonical: optionalText(500).refine((value) => !value || /^https?:\/\//.test(value), {
    message: "O canonical tem de ser um URL absoluto.",
  }),
  noindex: z.boolean().optional(),
});

export type SeoActionResult = { ok?: boolean; error?: string; notice?: string };
export type SeoSaveInput = z.input<typeof saveSchema>;

async function getAdminClient() {
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
  return profile?.role === "admin" ? supabase : null;
}

/** Cadeia vazia e `undefined` são a mesma coisa: "este campo não sobrepõe". */
const orNull = (value: string | undefined) => (value && value.trim() !== "" ? value.trim() : null);

export async function saveSeoPage(input: unknown): Promise<SeoActionResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados de SEO inválidos." };
  }

  const supabase = await getAdminClient();
  if (!supabase) return { error: "Sem autorização." };

  const data = parsed.data;
  const { error } = await supabase.rpc("admin_save_seo_page", {
    p_route: data.route,
    p_title_tag: orNull(data.titleTag) as unknown as string,
    p_meta_description: orNull(data.metaDescription) as unknown as string,
    p_og_same_as_page: (data.ogSameAsPage ?? null) as unknown as boolean,
    p_og_title: orNull(data.ogTitle) as unknown as string,
    p_og_description: orNull(data.ogDescription) as unknown as string,
    p_og_image: orNull(data.ogImage) as unknown as string,
    p_og_image_alt: orNull(data.ogImageAlt) as unknown as string,
    p_canonical: orNull(data.canonical) as unknown as string,
    p_noindex: (data.noindex ?? null) as unknown as boolean,
  });

  if (error) {
    return {
      error:
        error.hint === "not_authorized" ? "Sem autorização." : "Não foi possível guardar o SEO.",
    };
  }

  // Uma alteração de SEO é uma alteração ao que o site diz de si próprio a
  // quem nunca lá entrou. Fica com rasto, como as de plano e de flag.
  //
  // O SEO já está escrito, por isso uma falha aqui não desfaz nada — mas
  // também não se cala. Mesmo tratamento de `savePlan`: quem lê o registo tem
  // de saber que ele está incompleto.
  let notice: string | undefined;
  try {
    await writeAuditLog(supabase, {
      action: "seo.updated",
      entity: "seo_pages",
      entityId: data.route,
      diff: { after: data },
    });
  } catch {
    notice = "Guardado, mas o registo de auditoria falhou — avise a administração.";
  }

  revalidatePath("/admin/seo");
  return { ok: true, notice };
}
