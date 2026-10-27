import type { FileSource, SharePermission } from "@upm/db/cloud";

/**
 * Modelos de vista da Cloud (P6-01 · P6-02 · D71)
 * =========================================================================
 * O mesmo padrão de `interactionTypes.ts` da Fase 5: as funções SQL devolvem
 * `snake_case` com as colunas que a RLS deixa sair, e é aqui que isso vira o
 * que os componentes consomem. Nenhum componente da Cloud sabe que o Supabase
 * existe.
 *
 * **Vivia em `apps/app` e mudou-se para cá a 26 out 2026 (D71)**, quando a
 * Cloud da equipa deixou de ter ecrã próprio. As três rotas que mostram uma
 * Cloud — `/cloud`, `/suporte/cloud` e `/marketing/cloud` — passaram a montar
 * o mesmo `CloudScreen`, e um modelo de vista partilhado por duas apps não
 * podia continuar a viver dentro de uma delas.
 */

export type FolderKind = "user" | "property" | "property_documents";

export type FolderNode = {
  id: string;
  parentId: string | null;
  name: string;
  kind: FolderKind;
  propertyId: string | null;
  fileCount: number;
  /** Subpastas, já montadas em árvore por `buildFolderTree`. */
  children: FolderNode[];
};

export type CloudFileRow = {
  id: string;
  folderId: string | null;
  name: string;
  mime: string;
  size: number;
  source: FileSource;
  currentVersion: number;
  /** 07 §19.5 — documento do imóvel: vê-se e partilha-se, não se mexe daqui. */
  readonly: boolean;
  /**
   * "Só para si" · "Com João Costa" · "Com 2 pessoas". Vazio na Cloud da
   * equipa, onde não há partilhas para descrever — `scope = 'staff'` **é** a
   * partilha, e a coluna nem aparece.
   */
  sharedLabel: string;
  shareCount: number;
  hasLink: boolean;
  /**
   * Quem o carregou. Só a Cloud da equipa o preenche (D71): numa gaveta
   * partilhada é metade da informação útil, e na Cloud pessoal seria sempre a
   * mesma pessoa — o próprio.
   */
  ownerName: string | null;
  createdAt: string;
  /** Não-nulo = está na reciclagem (07 §13.1). */
  deletedAt: string | null;
};

export type SharedWithMeRow = {
  fileId: string;
  shareId: string;
  name: string;
  mime: string;
  size: number;
  permission: SharePermission;
  sharedByName: string;
  expiresAt: string | null;
  createdAt: string;
};

export type FileVersionRow = {
  version: number;
  name: string;
  size: number;
  createdAt: string;
  note: string | null;
};

export type FileAccessRow = {
  occurredAt: string;
  action: string;
  actorName: string;
  viaLink: boolean;
};

/** Uma pessoa com quem já se fala — a lista de destinos da partilha. */
export type ShareContact = {
  id: string;
  name: string;
};

/**
 * O que uma escrita da Cloud devolve. `notice` existe porque as escritas da
 * Cloud interna já traziam a sua própria frase de sucesso (D73 ainda as tem em
 * português dentro da action); quando vem, é ela que se diz, e não o rótulo
 * genérico que o ecrã tinha à mão.
 */
export type CloudWriteResult = { error?: string; notice?: string };

/**
 * Monta a árvore a partir da lista plana de `my_cloud_folders`. A função SQL já
 * ordena por `kind` e depois por nome; preservar essa ordem mantém as pastas de
 * utilizador antes das automáticas em qualquer nível.
 */
export function buildFolderTree(rows: Omit<FolderNode, "children">[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  for (const row of rows) byId.set(row.id, { ...row, children: [] });

  const roots: FolderNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Todos os ids de uma subárvore — a pasta escolhida e o que está dentro. */
export function folderSubtreeIds(node: FolderNode): string[] {
  return [node.id, ...node.children.flatMap(folderSubtreeIds)];
}

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
};

/**
 * `fallback` vem de quem chama, com a chave `cloud.fileFallback`: um MIME sem
 * barra não tem extensão para mostrar, e o rótulo que o substitui é texto que
 * o utilizador lê — logo não se escreve aqui.
 */
export function mimeLabel(mime: string, fallback = ""): string {
  return MIME_LABELS[mime] ?? mime.split("/").pop()?.toUpperCase() ?? fallback;
}

/**
 * Data curta, na etiqueta `Intl` do idioma escolhido (02 §12). O `locale` é
 * argumento e não constante porque "15 out 2026" e "15 Oct 2026" são a mesma
 * data escrita por duas convenções, e fixar `pt-PT` punha o mês em português
 * dentro de um ecrã inglês.
 */
export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
