"use server";

import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import { MAX_FILE_BYTES, shareFileSchema, sniffMime, type SharePermission } from "@upm/db/cloud";

/**
 * Cloud — Server Actions (P6-01 · P6-02)
 * =========================================================================
 * As regras vivem em SQL (`20260930120100_cloud_functions.sql`): quota,
 * versões, soft delete, partilhas e registo de acessos são funções
 * `security definer`. Esta camada faz o que o Postgres não pode fazer —
 * falar com o Storage e olhar para os bytes do ficheiro — e chama-as.
 *
 * Ordem do upload, e é deliberada (07 §19.8 #1): valida-se o conteúdo, põe-se o
 * objeto no bucket e SÓ DEPOIS se regista. Se a quota não chegar, o registo
 * recusa e o objeto é apagado aqui. Verificar a quota antes não fecha a janela
 * entre a verificação e a escrita.
 *
 * Caminhos no bucket `cloud`: o primeiro segmento é sempre o `owner_id` — é o
 * que a policy `cloud_objects_owner` avalia. O segundo é o `file_id` a partir
 * da segunda versão; na primeira ainda não existe (o id nasce no registo), e
 * usa-se uma chave aleatória. Cada objeto continua único e do dono.
 */

export type CloudActionState = { ok?: boolean; error?: string };

async function session() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * O código de acesso é guardado com o token por sal. Um código de 4–6 dígitos
 * tem um espaço pequeno demais para um SHA-256 seco ser mais do que decoração;
 * com o token à frente, a tabela arco-íris deixa de servir. O limite de
 * tentativas de 07 §19.8 continua a ser a defesa principal.
 */
function accessCodeHash(token: string, code: string) {
  return sha256(`${token}:${code}`);
}

function refresh() {
  revalidatePath("/cloud");
  revalidatePath("/painel");
}

// ---------------------------------------------------------------------------
// Pastas
// ---------------------------------------------------------------------------

export async function createFolder(name: string, parentId?: string): Promise<CloudActionState> {
  const clean = name.trim();
  if (clean.length < 1 || clean.length > 120) {
    return { error: "O nome da pasta tem entre 1 e 120 caracteres." };
  }

  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.from("folders").insert({
    owner_id: user.id,
    parent_id: parentId ?? null,
    name: clean,
    kind: "user",
  });
  if (error) return { error: "Não foi possível criar a pasta." };

  refresh();
  return { ok: true };
}

/** 07 §19.1: a pasta automática não se apaga enquanto o imóvel existir — mas renomear pode. */
export async function renameFolder(folderId: string, name: string): Promise<CloudActionState> {
  const clean = name.trim();
  if (clean.length < 1 || clean.length > 120) {
    return { error: "O nome da pasta tem entre 1 e 120 caracteres." };
  }

  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase
    .from("folders")
    .update({ name: clean })
    .eq("id", folderId)
    .eq("owner_id", user.id);
  if (error) return { error: "Não foi possível renomear a pasta." };

  refresh();
  return { ok: true };
}

export async function deleteFolder(folderId: string): Promise<CloudActionState> {
  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  // A policy `folders_delete_own` só alcança `kind = 'user'`; um delete a uma
  // pasta automática não falha, simplesmente não apaga nada. Dizê-lo aqui é o
  // que evita um "feito" silencioso que não fez nada.
  const { data: folder } = await supabase
    .from("folders")
    .select("kind")
    .eq("id", folderId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!folder) return { error: "Pasta inexistente." };
  if (folder.kind !== "user") {
    return { error: "A pasta de um imóvel só desaparece quando o imóvel desaparecer." };
  }

  const { error } = await supabase.from("folders").delete().eq("id", folderId);
  if (error) return { error: "Não foi possível eliminar a pasta." };

  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ficheiros
// ---------------------------------------------------------------------------

/**
 * Carregar um ficheiro. `formData` traz `file` e, opcionalmente, `folderId`.
 *
 * O tipo aceite decide-se pelos primeiros bytes (07 §19.8 #2) e não pela
 * extensão nem pelo `type` que o browser declara — os dois são escritos por
 * quem carrega.
 */
export async function uploadFile(formData: FormData): Promise<CloudActionState> {
  const file = formData.get("file");
  const folderId = (formData.get("folderId") as string | null) || null;

  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um ficheiro." };
  if (file.size > MAX_FILE_BYTES) return { error: "O ficheiro excede 25 MB." };

  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) return { error: "Só se aceitam ficheiros PDF, JPG e PNG." };

  const storagePath = `${user.id}/${randomUUID()}/1`;
  const { error: uploadError } = await supabase.storage
    .from("cloud")
    .upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (uploadError) return { error: "Não foi possível carregar o ficheiro." };

  const { error } = await supabase.rpc("cloud_register_upload", {
    // `p_folder_id` não tem valor por omissão na função SQL, por isso os tipos
    // gerados exigem-no. O Postgres aceita `null` — é a raiz da Cloud, o caso
    // de "Todos os ficheiros" —, e é isso que o cast diz.
    p_folder_id: folderId as unknown as string,
    p_name: file.name.slice(0, 200),
    p_mime: mime,
    p_size: file.size,
    p_storage_path: storagePath,
    p_checksum: createHash("sha256").update(bytes).digest("hex"),
  });

  if (error) {
    // O registo recusou (quota, pasta inválida, plano sem Cloud): o objeto não
    // pode ficar no bucket a ocupar espaço que ninguém contabiliza.
    await supabase.storage.from("cloud").remove([storagePath]);
    return { error: error.message || "Não foi possível guardar o ficheiro." };
  }

  refresh();
  return { ok: true };
}

/** Substituir cria versão nova; a anterior fica (07 §13.1) e conta (§19.8 #3). */
export async function replaceFile(formData: FormData): Promise<CloudActionState> {
  const file = formData.get("file");
  const fileId = formData.get("fileId") as string | null;
  const note = ((formData.get("note") as string | null) ?? "").trim() || null;

  if (!fileId) return { error: "Ficheiro inválido." };
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um ficheiro." };
  if (file.size > MAX_FILE_BYTES) return { error: "O ficheiro excede 25 MB." };

  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) return { error: "Só se aceitam ficheiros PDF, JPG e PNG." };

  const storagePath = `${user.id}/${fileId}/${randomUUID()}`;
  const { error: uploadError } = await supabase.storage
    .from("cloud")
    .upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (uploadError) return { error: "Não foi possível carregar a nova versão." };

  const { error } = await supabase.rpc("cloud_add_file_version", {
    p_file_id: fileId,
    p_name: file.name.slice(0, 200),
    p_mime: mime,
    p_size: file.size,
    p_storage_path: storagePath,
    p_checksum: createHash("sha256").update(bytes).digest("hex"),
    p_note: note ?? undefined,
  });

  if (error) {
    await supabase.storage.from("cloud").remove([storagePath]);
    return { error: error.message || "Não foi possível substituir o ficheiro." };
  }

  refresh();
  return { ok: true };
}

export async function restoreFileVersion(
  fileId: string,
  version: number,
): Promise<CloudActionState> {
  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("cloud_restore_file_version", {
    p_file_id: fileId,
    p_version: version,
  });
  if (error) return { error: error.message || "Não foi possível restaurar a versão." };

  refresh();
  return { ok: true };
}

export async function deleteFile(fileId: string): Promise<CloudActionState> {
  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("cloud_delete_file", { p_file_id: fileId });
  if (error) return { error: error.message || "Não foi possível eliminar o ficheiro." };

  refresh();
  return { ok: true };
}

/** 07 §19.8 #4 — antecipa a purga dos 30 dias e liberta a quota já. */
export async function emptyRecycleBin(): Promise<CloudActionState> {
  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("cloud_empty_recycle_bin");
  if (error) return { error: "Não foi possível esvaziar a reciclagem." };

  refresh();
  return { ok: true };
}

/**
 * URL assinada para ver ou transferir. O acesso é registado ANTES de a URL ser
 * emitida (07 §13.3): se o download falhar a meio, o pedido fica na mesma —
 * mais vale um falso positivo do que um acesso invisível.
 */
export async function fileDownloadUrl(
  fileId: string,
  action: "view" | "download" = "download",
): Promise<{ url?: string; error?: string }> {
  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { data: file } = await supabase
    .from("files")
    .select("bucket, storage_path, name, size")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return { error: "Ficheiro inexistente." };

  const requestHeaders = await headers();
  await supabase.rpc("log_document_access", {
    p_subject_type: "file",
    p_subject_id: fileId,
    p_action: action,
    p_ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    p_user_agent: requestHeaders.get("user-agent") ?? undefined,
    p_bytes_sent: action === "download" ? Number(file.size) : undefined,
  });

  const { data, error } = await supabase.storage
    .from(file.bucket)
    .createSignedUrl(file.storage_path, 60, {
      download: action === "download" ? file.name : undefined,
    });
  if (error || !data) return { error: "Não foi possível abrir o ficheiro." };

  return { url: data.signedUrl };
}

// ---------------------------------------------------------------------------
// Partilhas — P6-02
// ---------------------------------------------------------------------------

export type ShareFileInput = {
  fileId: string;
  permission: SharePermission;
  /** Partilha para uma pessoa OU por ligação, nunca as duas. */
  sharedWith?: string;
  asLink?: boolean;
  expiresInHours?: number | null;
  accessCode?: string;
};

export async function shareFile(
  input: ShareFileInput,
): Promise<{ ok?: boolean; url?: string; error?: string }> {
  const parsed = shareFileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Partilha inválida." };
  }
  const { fileId, permission, sharedWith, asLink, expiresInHours, accessCode } = parsed.data;

  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const token = asLink ? randomUUID().replace(/-/g, "") : null;
  const expiresAt = expiresInHours
    ? new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()
    : null;

  const { error } = await supabase.rpc("share_file", {
    p_file_id: fileId,
    p_permission: permission,
    p_shared_with: sharedWith ?? undefined,
    p_token: token ?? undefined,
    p_expires_at: expiresAt ?? undefined,
    p_access_code_hash: token && accessCode ? accessCodeHash(token, accessCode) : undefined,
  });
  if (error) return { error: error.message || "Não foi possível partilhar." };

  refresh();
  if (!token) return { ok: true };

  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ?? `https://${requestHeaders.get("host") ?? "upropertymarket.pt"}`;
  return { ok: true, url: `${origin}/partilha/${token}` };
}

export async function revokeFileShare(shareId: string): Promise<CloudActionState> {
  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("revoke_file_share", { p_share_id: shareId });
  if (error) return { error: error.message || "Não foi possível revogar a partilha." };

  refresh();
  return { ok: true };
}

/**
 * O que o drawer de detalhe mostra: versões (07 §13.1), acessos (§13.3) e as
 * partilhas ativas. Vem por pedido, não com a lista — carregar o histórico de
 * todos os ficheiros para mostrar o de um seria pagar por tudo para usar um.
 */
export async function fileDetails(fileId: string) {
  const { supabase, user } = await session();
  if (!user) return { versions: [], accesses: [], shares: [] };

  const [versions, accesses, shares] = await Promise.all([
    supabase
      .from("file_versions")
      .select("version, name, size, created_at, note")
      .eq("file_id", fileId)
      .order("version", { ascending: false }),
    supabase.rpc("file_access_log", { p_file_id: fileId }),
    supabase
      .from("file_shares")
      .select("id, shared_with, token, permission, expires_at")
      .eq("file_id", fileId)
      .is("revoked_at", null),
  ]);

  return {
    versions: (versions.data ?? []).map((row) => ({
      version: row.version,
      name: row.name,
      size: Number(row.size),
      createdAt: row.created_at,
      note: row.note,
    })),
    accesses: (accesses.data ?? []).map((row) => ({
      occurredAt: row.occurred_at,
      action: row.action as string,
      actorName: row.actor_name ?? "Utilizador",
      viaLink: row.via_link ?? false,
    })),
    shares: (shares.data ?? []).map((row) => ({
      id: row.id,
      sharedWith: row.shared_with,
      isLink: row.token !== null,
      permission: row.permission,
      expiresAt: row.expires_at,
    })),
  };
}

/**
 * Abrir uma ligação anónima. Chamada pela rota pública `/partilha/[token]` —
 * é o único caminho de leitura sem sessão, e passa pelo limite de tentativas
 * de 07 §19.8.
 */
export async function openSharedLink(token: string, code?: string) {
  const supabase = createClient(await cookies());

  const { data, error } = await supabase.rpc("resolve_file_share", {
    p_token: token,
    p_access_code_hash: code ? accessCodeHash(token, code) : undefined,
  });
  if (error) return { error: error.message || "Ligação inválida." };

  const row = data?.[0];
  if (!row) return { error: "Ligação inválida ou expirada." };
  if (row.needs_code) return { needsCode: true as const };

  const { data: file } = await supabase
    .from("files")
    .select("bucket, storage_path")
    .eq("id", row.file_id)
    .maybeSingle();
  if (!file) return { error: "Ficheiro indisponível." };

  await supabase.rpc("log_document_access", {
    p_subject_type: "file",
    p_subject_id: row.file_id,
    p_action: row.permission === "download" ? "download" : "view",
    p_share_id: row.share_id,
  });

  const { data: signed } = await supabase.storage
    .from(file.bucket)
    .createSignedUrl(file.storage_path, 300, {
      download: row.permission === "download" ? (row.file_name ?? undefined) : undefined,
    });

  return {
    name: row.file_name ?? "Documento",
    size: Number(row.size ?? 0),
    mime: row.mime ?? "application/pdf",
    permission: row.permission,
    url: signed?.signedUrl ?? null,
  };
}
