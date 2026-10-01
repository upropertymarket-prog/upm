import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@upm/db";

import type {
  ContractDetail,
  ContractHistoryRow,
  ContractRow,
  ContractSharedWithMeRow,
  TemplateRow,
} from "../components/contracts/contractTypes";

/**
 * Leituras dos contratos, do lado do servidor (P6-03)
 * =========================================================================
 * `my_contracts`, `available_contract_templates`, `contracts_shared_with_me` e
 * `contract_history` (migração `20260930120200_contracts.sql`). Pela mesma
 * razão da Cloud: a lista mostra o nome da contraparte e o título do imóvel, e
 * nenhum dos dois se alcança por `select` com join sem alargar a RLS.
 */

type Client = SupabaseClient<Database>;

/** Só os modelos PUBLICADOS: rascunhos e arquivados são do Admin (P6-04). */
export async function loadTemplates(supabase: Client): Promise<TemplateRow[]> {
  const { data } = await supabase.rpc("available_contract_templates");
  return (data ?? []).map((row) => ({
    id: row.id,
    familyId: row.family_id,
    kind: row.kind,
    name: row.name,
    version: row.version,
    variables: row.variables ?? [],
  }));
}

export async function loadContracts(supabase: Client): Promise<ContractRow[]> {
  const { data } = await supabase.rpc("my_contracts");
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    propertyId: row.property_id,
    propertyTitle: row.property_title,
    counterpartyName: row.counterparty_name ?? "",
    currentVersion: row.current_version,
    shareCount: row.share_count ?? 0,
    sharedAt: row.shared_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * O contrato aberto no editor. O corpo vem por `select` direto — a policy
 * `contracts_select_involved` já resolve quem o pode ler, e não há nada de
 * outra tabela a juntar. A lista de variáveis vem do modelo de origem: é o
 * modelo que sabe que campos existem, não o contrato.
 */
export async function loadContract(
  supabase: Client,
  contractId: string,
  rows: ContractRow[],
): Promise<ContractDetail | null> {
  const summary = rows.find((row) => row.id === contractId);
  if (!summary) return null;

  const { data } = await supabase
    .from("contracts")
    .select("body, values, template_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!data) return null;

  let variables: string[] = [];
  if (data.template_id) {
    const { data: template } = await supabase
      .from("contract_templates")
      .select("variables")
      .eq("id", data.template_id)
      .maybeSingle();
    variables = template?.variables ?? [];
  }

  return {
    ...summary,
    body: data.body,
    values: (data.values ?? {}) as Record<string, string>,
    variables,
  };
}

/** Separador Histórico (07 §13.5) — versões com autor, data e nota. */
export async function loadContractHistory(
  supabase: Client,
  contractId: string,
): Promise<ContractHistoryRow[]> {
  const { data } = await supabase.rpc("contract_history", { p_contract_id: contractId });
  return (data ?? []).map((row) => ({
    version: row.version,
    statusAtSave: row.status_at_save,
    frozen: row.frozen ?? false,
    authorName: row.author_name ?? "Utilizador",
    createdAt: row.created_at,
    note: row.note,
  }));
}

/**
 * 07 §5.5 — o contrato partilhado aparece em `/contratos` da contraparte, em
 * leitura. Devolve a versão CONGELADA, não o corpo que o dono continua a
 * editar: o que a contraparte viu não se reescreve por trás.
 */
export async function loadContractsSharedWithMe(
  supabase: Client,
): Promise<ContractSharedWithMeRow[]> {
  const { data } = await supabase.rpc("contracts_shared_with_me");
  return (data ?? []).map((row) => ({
    contractId: row.contract_id,
    shareId: row.share_id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    body: row.body,
    values: (row.values ?? {}) as Record<string, string>,
    permission: row.permission,
    sharedByName: row.shared_by_name ?? "Utilizador",
    expiresAt: row.expires_at,
    sharedAt: row.shared_at,
  }));
}
