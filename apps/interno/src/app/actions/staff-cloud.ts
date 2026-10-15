"use server";

import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import { asPendingRole } from "@upm/db/pending";
import {
  ALLOWED_FILE_MIMES,
  MAX_FILE_BYTES,
  deleteStaffCloudFile,
  registerStaffCloudFile,
  restoreStaffCloudFile,
  staffCloudFolder,
} from "@upm/db/cloud";

/**
 * A Cloud interna — escritas (P10-10 · 07 §24.6)
 * =========================================================================
 * **Partilhadas pelas duas rotas**, `/suporte/cloud` e `/marketing/cloud`, que
 * são o mesmo ecrã sobre a mesma gaveta. É a figura que 07 §24.5 e §24.6 já
 * usaram para o SEO: duas portas, um editor. Duas cópias divergiam à primeira
 * alteração, e aqui seria pior do que no SEO — divergiriam sobre ficheiros.
 *
 * ## O papel é `is_internal()`, não `is_staff()`
 *
 * Admin, Suporte **e** Marketing. É o predicado que 07 §24.6 criou precisamente
 * para este caso e que `20261015180000` pôs nas políticas de `folders` e
 * `files`. A verificação é nos dois lados (07 §20.5): aqui e dentro de cada
 * função `security definer`.
 *
 * ## O que não está aqui
 *
 * Partilhas. Na Cloud do cliente, partilhar é dar acesso a quem não o tinha;
 * na Cloud da equipa toda a gente já o tem — `scope = 'staff'` é a partilha.
 * Um botão de partilhar aqui só podia significar partilhar **para fora**, que é
 * outra funcionalidade e com outras perguntas (expira? leva código?).
 */

export type StaffCloudResult = { ok?: boolean; error?: string; notice?: string; url?: string };

/** O bucket da Cloud, o mesmo da Fase 6. */
const BUCKET = "cloud";

async function getInternalClient() {
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
  const role = asPendingRole(profile?.role);
  const internal = role === "admin" || role === "support" || role === "marketing";
  return internal ? { supabase, userId: user.id } : null;
}

/** As duas rotas que mostram esta gaveta — revalidam-se as duas, sempre. */
function revalidateBoth() {
  revalidatePath("/suporte/cloud");
  revalidatePath("/marketing/cloud");
}

export async function carregarFicheiro(formData: FormData): Promise<StaffCloudResult> {
  const file = formData.get("file");
  const folderId = formData.get("folderId");

  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um ficheiro." };
  if (file.size > MAX_FILE_BYTES) return { error: "O ficheiro excede 25 MB." };

  const session = await getInternalClient();
  if (!session) return { error: "Sem permissão para escrever na Cloud interna." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffCloudMime(bytes);
  // O tipo decide-se pelos primeiros bytes e não pela extensão nem pelo `type`
  // que o browser declara (07 §19.8 #2): os dois são escritos por quem carrega.
  if (!mime) return { error: "Só se aceitam PDF, JPG e PNG." };

  // `{uid}/{uuid}/1` — a convenção da Fase 6, com a versão no fim. É o caminho
  // que `cloud_add_file_version` continua a seguir quando houver substituição.
  const storagePath = `${session.userId}/${randomUUID()}/1`;

  const upload = await session.supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (upload.error) return { error: "Não foi possível guardar o ficheiro." };

  try {
    await registerStaffCloudFile(session.supabase, {
      name: file.name.slice(0, 200),
      mime,
      size: bytes.byteLength,
      storagePath,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      source: "upload",
      folderId: typeof folderId === "string" && folderId ? folderId : null,
    });
  } catch (error) {
    // O objeto já está no bucket e a linha não entrou: sem esta limpeza ficava
    // um ficheiro sem dono nem registo, invisível e a ocupar espaço. É o que
    // `attachmentToCloud` faz desde D66, e pela mesma razão.
    await session.supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: explain(error, "Não foi possível registar o ficheiro.") };
  }

  revalidateBoth();
  return { ok: true, notice: "Ficheiro guardado na Cloud interna." };
}

export async function criarPasta(name: unknown): Promise<StaffCloudResult> {
  const parsed = z.string().trim().min(1).max(120).safeParse(name);
  if (!parsed.success) return { error: "A pasta precisa de um nome." };

  const session = await getInternalClient();
  if (!session) return { error: "Sem permissão para escrever na Cloud interna." };

  // `staff_cloud_folder` cria-a ou devolve a que já existe com esse nome: duas
  // pastas "Relatórios" na gaveta de uma equipa é o princípio da desarrumação.
  try {
    await staffCloudFolder(session.supabase, parsed.data);
  } catch (error) {
    return { error: explain(error, "Não foi possível criar a pasta.") };
  }

  revalidateBoth();
  return { ok: true, notice: "Pasta criada." };
}

export async function apagarFicheiro(id: unknown): Promise<StaffCloudResult> {
  if (typeof id !== "string") return { error: "Pedido inválido." };

  const session = await getInternalClient();
  if (!session) return { error: "Sem permissão para escrever na Cloud interna." };

  try {
    await deleteStaffCloudFile(session.supabase, id);
  } catch (error) {
    return { error: explain(error, "Não foi possível apagar o ficheiro.") };
  }

  revalidateBoth();
  // Soft delete (07 §13.1): diz-se que vai para a reciclagem, porque é o que
  // acontece e porque é o que diz a quem se enganou que ainda dá para voltar.
  return { ok: true, notice: "Ficheiro na reciclagem — fica lá 30 dias." };
}

export async function reporFicheiro(id: unknown): Promise<StaffCloudResult> {
  if (typeof id !== "string") return { error: "Pedido inválido." };

  const session = await getInternalClient();
  if (!session) return { error: "Sem permissão para escrever na Cloud interna." };

  try {
    await restoreStaffCloudFile(session.supabase, id);
  } catch (error) {
    return { error: explain(error, "Não foi possível repor o ficheiro.") };
  }

  revalidateBoth();
  return { ok: true, notice: "Ficheiro reposto." };
}

/**
 * O URL de descarga, assinado e curto.
 *
 * Uma hora: é o tempo de clicar, não o de guardar o link. A política de storage
 * que torna isto possível para um ficheiro que **outra pessoa** carregou nasceu
 * em `20261015180000` — `cloud_objects_staff_select`, emparelhada por
 * `storage_path`. Sem ela, isto devolvia 403 para metade da equipa.
 */
export async function urlDeDescarga(id: unknown): Promise<StaffCloudResult> {
  if (typeof id !== "string") return { error: "Pedido inválido." };

  const session = await getInternalClient();
  if (!session) return { error: "Sem permissão para ler a Cloud interna." };

  const { data: file } = await session.supabase
    .from("files")
    .select("bucket, storage_path, name, scope")
    .eq("id", id)
    .maybeSingle();

  if (!file || file.scope !== "staff") return { error: "Ficheiro inexistente." };

  const { data, error } = await session.supabase.storage
    .from(file.bucket)
    .createSignedUrl(file.storage_path, 3600, { download: file.name });

  if (error || !data?.signedUrl) return { error: "Não foi possível abrir o ficheiro." };
  return { ok: true, url: data.signedUrl };
}

/** As mensagens das funções são escritas para serem lidas; passam quando as reconhecemos. */
function explain(error: unknown, fallback: string): string {
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : "";

  const conhecidas = [
    "Cloud interna é da equipa",
    "já não existe",
    "não é da Cloud interna",
    "formulário do imóvel",
    "excede 25 MB",
    "precisa de um nome",
    "Pasta inválida",
  ];
  return conhecidas.some((pedaco) => detail.includes(pedaco)) ? detail : fallback;
}

/** As assinaturas dos três formatos que a Cloud aceita (07 §19.8 #2). */
function sniffCloudMime(bytes: Uint8Array): (typeof ALLOWED_FILE_MIMES)[number] | null {
  const starts = (signature: number[]) => signature.every((byte, at) => bytes[at] === byte);

  if (starts([0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  return null;
}
