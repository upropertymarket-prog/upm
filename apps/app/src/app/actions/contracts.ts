"use server";

import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import {
  canAdvanceContract,
  createContractSchema,
  type ContractStatus,
  type SharePermission,
} from "@upm/db/cloud";

/**
 * Contratos — Server Actions (P6-03)
 * =========================================================================
 * Tudo o que muda um contrato passa por função SQL: `create_contract_from_
 * template`, `save_contract_version`, `set_contract_status`, `share_contract`
 * (migração `20260930120200_contracts.sql`). O que esta camada faz é validar
 * antes de lá chegar e revalidar as páginas depois.
 *
 * Duas regras que se veem daqui e vale a pena não esquecer:
 *
 * 1. **Nem toda a tecla gera versão** (07 §13.2). O autosave do editor fecha
 *    uma sessão de edição — ao sair, ao mudar de estado, ou após inatividade.
 *    Guardar a cada letra encheria o histórico de ruído e tornaria o separador
 *    Histórico ilegível, que é o oposto do que §13.2 quer.
 * 2. **O estado não anda para trás.** Está em `set_contract_status`; repete-se
 *    aqui só para dar uma mensagem em português em vez de um erro de Postgres.
 */

export type ContractActionState = { ok?: boolean; error?: string; id?: string };

async function session() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function accessCodeHash(token: string, code: string) {
  return createHash("sha256").update(`${token}:${code}`).digest("hex");
}

function refresh(contractId?: string) {
  revalidatePath("/contratos");
  revalidatePath("/painel");
  if (contractId) revalidatePath(`/contratos?contrato=${contractId}`);
}

export async function createContract(input: {
  templateId: string;
  title: string;
  propertyId?: string;
  counterpartyProfileId?: string;
  counterpartyName?: string;
}): Promise<ContractActionState> {
  const parsed = createContractSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados do contrato inválidos." };
  }

  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { data, error } = await supabase.rpc("create_contract_from_template", {
    p_template_id: parsed.data.templateId,
    p_title: parsed.data.title,
    p_property_id: parsed.data.propertyId ?? undefined,
    p_counterparty_profile_id: parsed.data.counterpartyProfileId ?? undefined,
    p_counterparty_name: parsed.data.counterpartyName || undefined,
  });
  if (error || !data) return { error: error?.message || "Não foi possível criar o contrato." };

  refresh();
  return { ok: true, id: data };
}

/**
 * Guardar — fecha uma sessão de edição e cria uma versão (07 §13.2). `note`
 * fica na versão e é o que o separador Histórico mostra.
 */
export async function saveContract(input: {
  contractId: string;
  body: unknown;
  values: Record<string, string>;
  note?: string;
}): Promise<ContractActionState> {
  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("save_contract_version", {
    p_contract_id: input.contractId,
    p_body: input.body as never,
    p_values: input.values as never,
    p_note: input.note ?? undefined,
  });
  if (error) return { error: error.message || "Não foi possível guardar o contrato." };

  refresh(input.contractId);
  return { ok: true };
}

export async function setContractStatus(
  contractId: string,
  status: ContractStatus,
  from: ContractStatus,
): Promise<ContractActionState> {
  if (!canAdvanceContract(from, status)) {
    return { error: "O estado de um contrato não anda para trás." };
  }

  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("set_contract_status", {
    p_contract_id: contractId,
    p_status: status,
  });
  if (error) return { error: error.message || "Não foi possível mudar o estado." };

  refresh(contractId);
  return { ok: true };
}

export async function shareContract(input: {
  contractId: string;
  permission: SharePermission;
  sharedWith?: string;
  asLink?: boolean;
  expiresInHours?: number | null;
  accessCode?: string;
}): Promise<{ ok?: boolean; url?: string; error?: string }> {
  if (Boolean(input.sharedWith) === Boolean(input.asLink)) {
    return { error: "Uma partilha é para uma pessoa ou por ligação, não as duas." };
  }

  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const token = input.asLink ? randomUUID().replace(/-/g, "") : null;
  const expiresAt = input.expiresInHours
    ? new Date(Date.now() + input.expiresInHours * 3600 * 1000).toISOString()
    : null;

  const { error } = await supabase.rpc("share_contract", {
    p_contract_id: input.contractId,
    p_permission: input.permission,
    p_shared_with: input.sharedWith ?? undefined,
    p_token: token ?? undefined,
    p_expires_at: expiresAt ?? undefined,
    p_access_code_hash:
      token && input.accessCode ? accessCodeHash(token, input.accessCode) : undefined,
  });
  if (error) return { error: error.message || "Não foi possível partilhar o contrato." };

  refresh(input.contractId);
  if (!token) return { ok: true };

  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ?? `https://${requestHeaders.get("host") ?? "upropertymarket.pt"}`;
  return { ok: true, url: `${origin}/contrato-partilhado/${token}` };
}

export async function revokeContractShare(shareId: string): Promise<ContractActionState> {
  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("revoke_contract_share", { p_share_id: shareId });
  if (error) return { error: error.message || "Não foi possível revogar a partilha." };

  refresh();
  return { ok: true };
}

/**
 * "Exportar PDF gera ficheiro no dispositivo" (04 §8.3). A geração é do
 * browser — o navegador imprime a pré-visualização para PDF, que é o caminho
 * que produz exatamente o que está no ecrã, com as variáveis já substituídas.
 * O que esta ação faz é a parte que o browser não pode fazer: deixar o acesso
 * no registo de 07 §13.3, para "exportado em PDF" ser tão rastreável como
 * "transferido".
 */
export async function logContractExport(contractId: string): Promise<void> {
  const { supabase, user } = await session();
  if (!user) return;

  const requestHeaders = await headers();
  await supabase.rpc("log_document_access", {
    p_subject_type: "contract",
    p_subject_id: contractId,
    p_action: "export_pdf",
    p_ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    p_user_agent: requestHeaders.get("user-agent") ?? undefined,
  });
}

/** As partilhas ativas de um contrato — o bloco "Com acesso" do modal. */
export async function contractShares(contractId: string) {
  const { supabase, user } = await session();
  if (!user) return [];

  const { data } = await supabase
    .from("contract_shares")
    .select("id, shared_with_profile_id, token, permission, expires_at")
    .eq("contract_id", contractId)
    .is("revoked_at", null);

  return (data ?? []).map((row) => ({
    id: row.id,
    sharedWith: row.shared_with_profile_id,
    isLink: row.token !== null,
    permission: row.permission,
    expiresAt: row.expires_at,
  }));
}
