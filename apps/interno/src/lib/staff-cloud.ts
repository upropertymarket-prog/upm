import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@upm/db";
import { staffCloudStatus } from "@upm/db/cloud";
import type { CloudStatus } from "@upm/db/cloud";
import type { CloudFileRow, FolderNode } from "@upm/cloud";

/**
 * A Cloud interna — leituras (P10-10 · 07 §24.6 · 05 §1.9 · D71)
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
 *
 * ## Devolve os modelos de `@upm/cloud` desde 26 out 2026 (D71)
 *
 * Tinha tipos próprios (`StaffFolder`, `StaffFile`) porque tinha ecrã próprio.
 * Agora as três rotas que mostram uma Cloud montam o mesmo `CloudScreen`, e a
 * forma das linhas é a dele. É também a razão de `loadStaffCloud` ser **uma**
 * função e não duas: a contagem de ficheiros por pasta, que a coluna das pastas
 * mostra, vem do mesmo par de leituras — `my_cloud_folders` calcula-a em SQL
 * para o lado do cliente, e aqui não há função equivalente.
 */

type Client = SupabaseClient<Database>;

export type StaffCloud = { folders: FolderNode[]; files: CloudFileRow[]; status: CloudStatus };

/**
 * Os ficheiros da equipa, com o nome de quem os carregou, e as pastas com a
 * conta de cada uma.
 *
 * O `join` a `profiles` é o que transforma "um ficheiro" em "um ficheiro que a
 * Ana pôs aqui" — numa gaveta partilhada é metade da informação útil, e sem ele
 * a lista obriga a perguntar no chat de quem é cada coisa.
 */
export async function loadStaffCloud(client: Client): Promise<StaffCloud> {
  const [folderRows, fileRows] = await Promise.all([
    client.from("folders").select("id, name").eq("scope", "staff").order("name"),
    client
      .from("files")
      .select(
        "id, folder_id, name, mime, size, source, current_version, owner_id, created_at, deleted_at, profiles!files_owner_id_fkey(full_name)",
      )
      .eq("scope", "staff")
      .order("created_at", { ascending: false }),
  ]);

  const files: CloudFileRow[] = (fileRows.data ?? []).map((row) => {
    const owner = row.profiles as { full_name: string | null } | null;
    return {
      id: row.id,
      folderId: row.folder_id,
      name: row.name,
      mime: row.mime,
      size: Number(row.size ?? 0),
      source: row.source,
      currentVersion: row.current_version ?? 1,
      // Um documento de imóvel continua a ser do formulário do imóvel, mesmo
      // que alguém o tenha guardado na gaveta da equipa (07 §19.5).
      readonly: row.source === "property_document",
      // Vazios: a coluna "Partilha" não existe nesta Cloud. `scope = 'staff'`
      // **é** a partilha, e não há nada para descrever linha a linha.
      sharedLabel: "",
      shareCount: 0,
      hasLink: false,
      ownerName: owner?.full_name ?? null,
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
    };
  });

  // Só os vivos contam: uma pasta a dizer "3" com os três na reciclagem manda
  // abri-la para encontrar uma lista vazia.
  const counts = new Map<string, number>();
  for (const file of files) {
    if (file.deletedAt !== null || file.folderId === null) continue;
    counts.set(file.folderId, (counts.get(file.folderId) ?? 0) + 1);
  }

  const folders: FolderNode[] = (folderRows.data ?? []).map((row) => ({
    id: row.id,
    parentId: null,
    name: row.name,
    // `kind: "user"` — são pastas que alguém criou à mão, não as automáticas de
    // um imóvel. É o que lhes dá o ícone de pasta na coluna da esquerda.
    kind: "user",
    propertyId: null,
    fileCount: counts.get(row.id) ?? 0,
    // Um nível só, por decisão (07 §24.6): uma gaveta de equipa com três pastas
    // encontra-se; com uma árvore, não — e a árvore pede mover, que pede
    // arrastar, que é outro ecrã. Há `parent_id` na tabela desde a Fase 6 para
    // quando houver razão.
    children: [],
  }));

  // O consumo conta **também o que está na reciclagem**, que é o que ocupa
  // espaço de facto: um ficheiro apagado só liberta o bucket quando a purga de
  // 30 dias passa (07 §13.6). Mostrar só os vivos dava um número menor do que a
  // conta real, e era logo no sítio onde se vai decidir se o tecto sobe.
  const usedBytes = files.reduce((total, file) => total + file.size, 0);

  return { folders, files, status: staffCloudStatus(usedBytes) };
}
