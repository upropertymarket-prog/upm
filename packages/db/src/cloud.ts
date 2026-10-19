import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { MailDatabase } from "./pending-types";

/**
 * Cloud e contratos (Fase 6) — 05 §6.4 e §6.5, 07 §13, 07 §19.
 * =========================================================================
 * Os estados, permissões e limites também existem como `check`/enum nas
 * migrações `20260930120000_cloud.sql` e `20260930120200_contracts.sql`; aqui
 * validam-se antes de a Server Action chegar ao Postgres, nunca em vez dele —
 * o mesmo padrão de `properties.ts` e `interaction.ts`.
 */

// ---------------------------------------------------------------------------
// Ficheiros — 07 §19.8
// ---------------------------------------------------------------------------

/** 07 §19.8 #2 — o limite e os tipos vêm do protótipo, não são escolha nossa. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_FILE_MIMES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type AllowedFileMime = (typeof ALLOWED_FILE_MIMES)[number];

/**
 * Assinaturas de conteúdo dos tipos aceites (07 §19.8 #2: "validados por
 * assinatura de conteúdo — não pela extensão nem pelo MIME que o browser
 * declara"). Um `.pdf` renomeado a partir de um executável não passa daqui.
 */
const MAGIC_BYTES: Record<AllowedFileMime, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
};

/** Devolve o MIME que o CONTEÚDO diz ser, ou null se não for aceite. */
export function sniffMime(bytes: Uint8Array): AllowedFileMime | null {
  for (const mime of ALLOWED_FILE_MIMES) {
    for (const signature of MAGIC_BYTES[mime]) {
      if (signature.every((byte, index) => bytes[index] === byte)) return mime;
    }
  }
  return null;
}

export const FILE_SOURCES = [
  "upload",
  "property_document",
  "message_attachment",
  "contract",
  "invoice",
] as const;
export type FileSource = (typeof FILE_SOURCES)[number];

// ---------------------------------------------------------------------------
// Partilhas — 07 §19.7 e §19.11
// ---------------------------------------------------------------------------

/** 07 §19.7: `edit` NUNCA foi uma permissão de partilha. */
export const SHARE_PERMISSIONS = ["view", "download"] as const;
export const sharePermissionSchema = z.enum(SHARE_PERMISSIONS);
export type SharePermission = (typeof SHARE_PERMISSIONS)[number];

/**
 * As opções de expiração do protótipo. `hours: null` é "sem expirar", que se
 * mantém por decisão do cliente (07 §19.11) — a rede de segurança é a
 * revogação e o registo de acessos, não o prazo.
 *
 * **`key` e não `label`**: este pacote fala com a base de dados e não sabe em
 * que idioma o ecrã está. O rótulo vive em `share.expiry.*` nas mensagens, e
 * quem monta o `Select` é que o traduz. As horas, essas, são as mesmas nos
 * dois idiomas. O mesmo valeu para o `SHARE_PERMISSION_LABELS` que aqui
 * estava: passou a `share.permission.*`.
 */
export const SHARE_EXPIRY_OPTIONS = [
  { key: "hours24", hours: 24 },
  { key: "days7", hours: 24 * 7 },
  { key: "days30", hours: 24 * 30 },
  { key: "never", hours: null },
] as const;

export const shareFileSchema = z
  .object({
    fileId: z.string().uuid(),
    permission: sharePermissionSchema.default("view"),
    /** Partilha para uma pessoa OU por ligação, nunca as duas. */
    sharedWith: z.string().uuid().optional(),
    asLink: z.boolean().default(false),
    expiresInHours: z.number().int().positive().nullable().default(null),
    accessCode: z.string().min(4).max(6).optional(),
  })
  .refine((value) => Boolean(value.sharedWith) !== value.asLink, {
    message: "Uma partilha é para uma pessoa ou por ligação, não as duas.",
  });

// ---------------------------------------------------------------------------
// Contratos — 05 §6.5, 04 §8.3
// ---------------------------------------------------------------------------

export const CONTRACT_STATUSES = [
  "draft",
  "shared",
  "awaiting_signature",
  "signed",
  "completed",
] as const;
export const contractStatusSchema = z.enum(CONTRACT_STATUSES);
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/**
 * As etiquetas de 04 §8.3 **não vivem aqui**: estão em `contracts.status.*`
 * nas mensagens, e quem monta o ecrã é que as traduz. Mesma razão do
 * `SHARE_PERMISSION_LABELS`, que saiu a 19 out — este pacote fala com a base
 * de dados e não sabe em que idioma o ecrã está. O que fica é a ordem do
 * ciclo (`CONTRACT_STATUSES`) e os tons, que são os mesmos nos dois idiomas.
 */

/**
 * Tons de estado. 04 §5.6 **não** define uma família de cores para contratos,
 * e inventar uma partiria a regra de "uma cor, um significado" que
 * `StatusTag.test.ts` vigia. Usa-se a família genérica de ciclo de vida, que
 * existe para isto. Patch proposto a 04 §5.6 no fim da fase.
 */
export const CONTRACT_STATUS_TONES: Record<ContractStatus, string> = {
  draft: "draft",
  shared: "new",
  awaiting_signature: "pending",
  signed: "active",
  completed: "archived",
};

/** 07 §19 / 04 §8.3: o ciclo é manual, mas não anda para trás. */
export const CONTRACT_STATUS_RANK: Record<ContractStatus, number> = {
  draft: 0,
  shared: 1,
  awaiting_signature: 2,
  signed: 3,
  completed: 4,
};

export function canAdvanceContract(from: ContractStatus, to: ContractStatus) {
  return CONTRACT_STATUS_RANK[to] > CONTRACT_STATUS_RANK[from];
}

export const CONTRACT_KINDS = ["sale", "rent"] as const;
export const contractKindSchema = z.enum(CONTRACT_KINDS);
export type ContractKind = (typeof CONTRACT_KINDS)[number];

/** Os dois tipos lado a lado de 04 §8.3 têm rótulo em `contracts.kind.*`. */

export const createContractSchema = z.object({
  templateId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  propertyId: z.string().uuid().optional(),
  counterpartyProfileId: z.string().uuid().optional(),
  counterpartyName: z.string().trim().max(160).default(""),
});

// ---------------------------------------------------------------------------
// Quota — 07 §19.2, §19.3 e §19.4
// ---------------------------------------------------------------------------

export type CloudStatus = {
  hasCloud: boolean;
  usedBytes: number;
  /** `null` = ilimitado (07 §19.2). */
  limitBytes: number | null;
  /** 07 §19.4 — a 80 % de qualquer outro limite do plano. */
  nearPlanLimit: boolean;
};

/**
 * 07 §19.4 — qual dos dois convites mostrar. Quem está perto do limite do
 * plano não tem um problema de Cloud, tem um problema de plano, e a app não
 * lhe deve empurrar o extra.
 */
export function cloudUpsell(status: CloudStatus) {
  if (status.nearPlanLimit) return "upgrade" as const;
  return "either" as const;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // Milhares com espaço e decimal com vírgula, como 04 §8.5 pede nos números.
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${units[unit]}`;
}

// ---------------------------------------------------------------------------
// A Cloud interna — scope `staff` (D66, completa em P10-10)
//
// A mesma tabela da Cloud do cliente, com `scope = 'staff'`: a nota de
// `folders` di-lo desde a Fase 6 ("a Cloud interna do Suporte é a mesma tabela
// com scope='staff'"). O que a distingue é quem lá chega — `is_internal()`
// desde `20261015180000`, para o Marketing entrar com o Suporte e o Admin.
//
// Estas duas peças nasceram em `mail.ts` com D66, porque o primeiro chamador
// foi o anexo de correio guardado na Cloud. Mudaram-se para aqui em P10-10, ao
// ganharem um segundo chamador — o ecrã da Cloud interna: o que fazem é
// registar um ficheiro na Cloud, e deixá-las no módulo do correio obrigava a
// Cloud a importar correio.
// ---------------------------------------------------------------------------

export const cloudStaffFileSchema = z.object({
  name: z.string().trim().min(1).max(200),
  mime: z.string().min(1).max(200),
  size: z.number().int().nonnegative(),
  storagePath: z.string().min(1).max(500),
  checksum: z.string().min(16).max(128),
  /** A pasta da Cloud interna. Nula põe o ficheiro na raiz (P10-10). */
  folderId: z.string().uuid().nullish(),
});

/**
 * Registra o ficheiro na Cloud interna (`scope = 'staff'`). Corre **depois** de
 * o objeto estar no bucket `cloud`, como `cloud_register_upload` desde a Fase
 * 6 — e é a única porta: `files` não tem policy de `insert` desde
 * `20260930120300`, porque um insert direto passava ao lado da quota.
 */
export async function registerStaffCloudFile(
  client: SupabaseClient<Database>,
  input: z.infer<typeof cloudStaffFileSchema> & { source: string },
): Promise<string> {
  // A mesma costura de `mail.ts` e `campaigns.ts`: sai com o `db:types` (D64).
  const staff = client as unknown as SupabaseClient<MailDatabase>;

  const { data, error } = await staff.rpc("cloud_register_staff_file", {
    p_name: input.name,
    p_mime: input.mime,
    p_size: input.size,
    p_storage_path: input.storagePath,
    p_checksum: input.checksum,
    p_source: input.source,
    p_folder_id: input.folderId ?? null,
  });

  if (error) throw new Error(error.message);
  return String(data);
}

/**
 * As outras três portas da Cloud interna (P10-10).
 *
 * A costura com `MailDatabase` fica aqui e não em cada chamador, que é a lição
 * de D52 e a razão de `pending-types.ts` existir: os `as` dispersos sobrevivem
 * à regeneração que os torna desnecessários, porque ninguém sabe onde estão.
 */
export async function staffCloudFolder(
  client: SupabaseClient<Database>,
  name: string,
): Promise<string> {
  const staff = client as unknown as SupabaseClient<MailDatabase>;
  const { data, error } = await staff.rpc("staff_cloud_folder", { p_name: name });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function deleteStaffCloudFile(
  client: SupabaseClient<Database>,
  fileId: string,
): Promise<void> {
  const staff = client as unknown as SupabaseClient<MailDatabase>;
  const { error } = await staff.rpc("cloud_delete_staff_file", { p_file_id: fileId });
  if (error) throw new Error(error.message);
}

export async function restoreStaffCloudFile(
  client: SupabaseClient<Database>,
  fileId: string,
): Promise<void> {
  const staff = client as unknown as SupabaseClient<MailDatabase>;
  const { error } = await staff.rpc("cloud_restore_staff_file", { p_file_id: fileId });
  if (error) throw new Error(error.message);
}
