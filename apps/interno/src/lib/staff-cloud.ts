import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@upm/db";

/**
 * A Cloud interna — leituras (P10-10 · 07 §24.6 · 05 §1.9)
 * =========================================================================
 * **É a mesma tabela da Cloud do cliente, com `scope = 'staff'`.** Não é uma
 * segunda Cloud: `folders` e `files` nasceram na Fase 6 com a coluna `scope` e
 * com as políticas já escritas para este caso — a nota de `folders` diz-o desde
 * então ("a Cloud interna do Suporte é a mesma tabela com scope='staff'").
 * `20261015180000` fez a única coisa que faltava: trocar `is_staff()` por
 * `is_internal()`, para que o Marketing entre também.
 *
 * Por isso não há filtro de `owner_id` em lado nenhum deste ficheiro, e isso é
 * a diferença que define o ecrã: na Cloud pessoal vê-se o que é nosso, na
 * interna vê-se o que é da equipa. Quem carregou fica como informação na lista,
 * não como permissão.
 *
 * As leituras são `select` direto porque as políticas já dizem quem pode ler.
 * As escritas são todas por função `security definer` — `files` não tem policy
 * de `insert` desde `20260930120300`, de propósito.
 */

type Client = SupabaseClient<Database>;

export type StaffFolder = { id: string; name: string };

export type StaffFile = {
  id: string;
  folderId: string | null;
  name: string;
  mime: string;
  size: number;
  bucket: string;
  storagePath: string;
  source: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  deletedAt: string | null;
};

export async function listStaffFolders(client: Client): Promise<StaffFolder[]> {
  const { data } = await client
    .from("folders")
    .select("id, name")
    .eq("scope", "staff")
    .order("name");

  return data ?? [];
}

/**
 * Os ficheiros da equipa, com o nome de quem os carregou.
 *
 * O `join` a `profiles` é o que transforma "um ficheiro" em "um ficheiro que a
 * Ana pôs aqui" — numa gaveta partilhada é metade da informação útil, e sem ele
 * a lista obriga a perguntar no chat de quem é cada coisa.
 */
export async function listStaffFiles(client: Client): Promise<StaffFile[]> {
  const { data } = await client
    .from("files")
    .select(
      "id, folder_id, name, mime, size, bucket, storage_path, source, owner_id, created_at, deleted_at, profiles!files_owner_id_fkey(full_name)",
    )
    .eq("scope", "staff")
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const owner = row.profiles as { full_name: string | null } | null;
    return {
      id: row.id,
      folderId: row.folder_id,
      name: row.name,
      mime: row.mime,
      size: Number(row.size ?? 0),
      bucket: row.bucket,
      storagePath: row.storage_path,
      source: row.source,
      ownerId: row.owner_id,
      ownerName: owner?.full_name ?? "",
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
    };
  });
}
