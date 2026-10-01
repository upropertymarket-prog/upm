import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@upm/db";
import type { CloudStatus } from "@upm/db/cloud";

import {
  buildFolderTree,
  type CloudFileRow,
  type FileAccessRow,
  type FileVersionRow,
  type FolderNode,
  type ShareContact,
  type SharedWithMeRow,
} from "../components/cloud/cloudTypes";

/**
 * Leituras da Cloud, do lado do servidor (P6-01 · P6-02)
 * =========================================================================
 * Tudo por função `security definer` — `my_cloud_folders`, `my_cloud_files`,
 * `shared_with_me`, `file_access_log` (migração `20260930120100`). A razão é a
 * mesma da Fase 5: a coluna "Partilha" mostra o nome de outra pessoa, e a RLS
 * de `profiles` não deixa um utilizador lê-lo. Alargar a policy daria muito
 * mais do que uma lista de ficheiros precisa.
 */

type Client = SupabaseClient<Database>;

/** O primeiro read de `/cloud`: sem isto não se sabe sequer o que desenhar. */
export async function loadCloudStatus(supabase: Client): Promise<CloudStatus> {
  const { data } = await supabase.rpc("cloud_status");
  const row = data?.[0];
  return {
    hasCloud: row?.has_cloud ?? false,
    usedBytes: Number(row?.used_bytes ?? 0),
    limitBytes:
      row?.limit_bytes === null || row?.limit_bytes === undefined ? null : Number(row.limit_bytes),
    nearPlanLimit: row?.near_plan_limit ?? false,
  };
}

export async function loadFolders(supabase: Client): Promise<FolderNode[]> {
  const { data } = await supabase.rpc("my_cloud_folders");
  return buildFolderTree(
    (data ?? []).map((row) => ({
      id: row.id,
      parentId: row.parent_id,
      name: row.name,
      kind: row.kind,
      propertyId: row.property_id,
      fileCount: row.file_count ?? 0,
    })),
  );
}

/** Sem `folderId` devolve a Cloud inteira — é a vista "Todos os ficheiros". */
export async function loadFiles(supabase: Client, folderId?: string): Promise<CloudFileRow[]> {
  const { data } = await supabase.rpc("my_cloud_files", {
    p_folder_id: folderId ?? undefined,
  });
  return (data ?? []).map((row) => ({
    id: row.id,
    folderId: row.folder_id,
    name: row.name,
    mime: row.mime,
    size: Number(row.size),
    source: row.source,
    currentVersion: row.current_version,
    readonly: row.readonly ?? false,
    sharedLabel: row.shared_label ?? "Só para si",
    shareCount: row.share_count ?? 0,
    hasLink: row.has_link ?? false,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  }));
}

export async function loadSharedWithMe(supabase: Client): Promise<SharedWithMeRow[]> {
  const { data } = await supabase.rpc("shared_with_me");
  return (data ?? []).map((row) => ({
    fileId: row.file_id,
    shareId: row.share_id,
    name: row.name,
    mime: row.mime,
    size: Number(row.size),
    permission: row.permission,
    sharedByName: row.shared_by_name ?? "Utilizador",
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

/** Separador "Versões" do drawer de detalhe (07 §13.1). */
export async function loadFileVersions(
  supabase: Client,
  fileId: string,
): Promise<FileVersionRow[]> {
  const { data } = await supabase
    .from("file_versions")
    .select("version, name, size, created_at, note")
    .eq("file_id", fileId)
    .order("version", { ascending: false });

  return (data ?? []).map((row) => ({
    version: row.version,
    name: row.name,
    size: Number(row.size),
    createdAt: row.created_at,
    note: row.note,
  }));
}

/** Separador "Acessos" do drawer de detalhe (07 §13.3 e §13.5). */
export async function loadFileAccessLog(
  supabase: Client,
  fileId: string,
): Promise<FileAccessRow[]> {
  const { data } = await supabase.rpc("file_access_log", { p_file_id: fileId });
  return (data ?? []).map((row) => ({
    occurredAt: row.occurred_at,
    action: row.action,
    actorName: row.actor_name ?? "Utilizador",
    viaLink: row.via_link ?? false,
  }));
}

/**
 * Com quem se pode partilhar — DECISÃO DO AGENTE, por registar em 07.
 *
 * O protótipo mostra um campo de pessoa no modal de partilha, mas nenhum doc
 * diz como se encontra essa pessoa, e não existe função que resolva um perfil
 * por e-mail. Procurar utilizadores por e-mail a partir da app seria um
 * enumerador de contas — exatamente o que 02 §7.1 evita ao fechar `profiles`.
 *
 * Fica: partilha-se com quem já se fala, ou seja, com a contraparte de uma
 * conversa (`my_conversations`, Fase 5). É o caso real — o documento vai para o
 * comprador com quem se está a negociar. Quem não tiver conversa usa a ligação.
 */
export async function loadShareContacts(supabase: Client): Promise<ShareContact[]> {
  const { data } = await supabase.rpc("my_conversations");
  const seen = new Map<string, ShareContact>();
  for (const row of data ?? []) {
    if (!seen.has(row.other_id)) {
      seen.set(row.other_id, { id: row.other_id, name: row.other_name ?? "Utilizador" });
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "pt"));
}
