"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import { contractKindSchema } from "@upm/db/cloud";

export type TemplateActionState = { ok?: boolean; error?: string; id?: string };

async function client() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function adminClient() {
  const result = await client();
  if (!result.user) return { ...result, isAdmin: false };
  const { data: profile } = await result.supabase
    .from("profiles")
    .select("role")
    .eq("id", result.user.id)
    .maybeSingle();
  return { ...result, isAdmin: profile?.role === "admin" };
}

function parseBody(value: string): unknown {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("O corpo tem de ser um JSON TipTap válido.");
  return parsed;
}

function variables(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,\n]/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export async function createTemplate(
  _prev: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const kind = contractKindSchema.safeParse(formData.get("kind"));
  if (!name) return { error: "Indique o nome do modelo." };
  if (!kind.success) return { error: "Escolha o tipo de contrato." };

  let body: unknown;
  try {
    body = parseBody(String(formData.get("body") ?? "{}"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Conteúdo inválido." };
  }

  const { supabase, user, isAdmin } = await adminClient();
  if (!user) return { error: "Sessão inválida." };
  if (!isAdmin) return { error: "Sem permissão." };
  const { data, error } = await supabase
    .from("contract_templates")
    .insert({
      family_id: crypto.randomUUID(),
      name,
      kind: kind.data,
      body: body as never,
      variables: variables(String(formData.get("variables") ?? "")),
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Não foi possível criar o modelo." };
  revalidatePath("/admin/contratos");
  return { ok: true, id: data.id };
}

export async function saveTemplate(
  templateId: string,
  formData: FormData,
): Promise<TemplateActionState> {
  const name = String(formData.get("name") ?? "").trim();
  let body: unknown;
  try {
    body = parseBody(String(formData.get("body") ?? "{}"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Conteúdo inválido." };
  }
  if (!name) return { error: "Indique o nome do modelo." };

  const { supabase, user, isAdmin } = await adminClient();
  if (!user) return { error: "Sessão inválida." };
  if (!isAdmin) return { error: "Sem permissão." };
  const { error } = await supabase
    .from("contract_templates")
    .update({
      name,
      body: body as never,
      variables: variables(String(formData.get("variables") ?? "")),
    })
    .eq("id", templateId)
    .eq("status", "draft");
  if (error) return { error: error.message };
  revalidatePath("/admin/contratos");
  return { ok: true, id: templateId };
}

export async function startTemplateVersion(familyId: string): Promise<TemplateActionState> {
  const { supabase, user, isAdmin } = await adminClient();
  if (!user) return { error: "Sessão inválida." };
  if (!isAdmin) return { error: "Sem permissão." };
  const { data, error } = await supabase.rpc("draft_contract_template_version", {
    p_family_id: familyId,
  });
  if (error || !data) return { error: error?.message ?? "Não foi possível abrir uma nova versão." };
  revalidatePath("/admin/contratos");
  return { ok: true, id: data };
}

export async function publishTemplate(templateId: string): Promise<TemplateActionState> {
  const { supabase, user, isAdmin } = await adminClient();
  if (!user) return { error: "Sessão inválida." };
  if (!isAdmin) return { error: "Sem permissão." };
  const { data, error } = await supabase.rpc("publish_contract_template", {
    p_template_id: templateId,
  });
  if (error || !data) return { error: error?.message ?? "Não foi possível publicar o modelo." };
  revalidatePath("/admin/contratos");
  return { ok: true, id: data };
}
