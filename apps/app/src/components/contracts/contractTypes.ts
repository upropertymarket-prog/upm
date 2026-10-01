import type { ContractKind, ContractStatus } from "@upm/db/cloud";

/**
 * Modelos de vista dos contratos (P6-03)
 * =========================================================================
 * A distinção que atravessa tudo (05 §6.5): um **modelo** é texto com
 * variáveis e pertence à administração; um **contrato** é gerado de um modelo,
 * tem valores concretos e pertence ao proprietário. As duas tabs de 04 §8.3
 * mostram exatamente estas duas coisas, e nunca se editam no mesmo sítio — o
 * editor de modelos é do Admin (P6-04).
 */

export type TemplateRow = {
  id: string;
  familyId: string;
  kind: ContractKind;
  name: string;
  version: number;
  variables: string[];
};

export type ContractRow = {
  id: string;
  title: string;
  kind: ContractKind;
  status: ContractStatus;
  propertyId: string | null;
  propertyTitle: string | null;
  counterpartyName: string;
  currentVersion: number;
  shareCount: number;
  sharedAt: string | null;
  updatedAt: string;
};

/** O contrato aberto no editor — o corpo e os valores das variáveis. */
export type ContractDetail = ContractRow & {
  body: unknown;
  values: Record<string, string>;
  variables: string[];
};

export type ContractHistoryRow = {
  version: number;
  statusAtSave: ContractStatus;
  frozen: boolean;
  authorName: string;
  createdAt: string;
  note: string | null;
};

export type ContractSharedWithMeRow = {
  contractId: string;
  shareId: string;
  title: string;
  kind: ContractKind;
  status: ContractStatus;
  body: unknown;
  values: Record<string, string>;
  permission: "view" | "download";
  sharedByName: string;
  expiresAt: string | null;
  sharedAt: string;
};

/**
 * A etiqueta legível de uma variável. As variáveis viajam por `name`
 * (`proprietario`), mas o chip e o painel mostram "Proprietário" — e o mesmo
 * `label` tem de aparecer nos dois sítios, senão o utilizador preenche um campo
 * e vê outro mudar.
 */
const VARIABLE_LABELS: Record<string, string> = {
  proprietario: "Proprietário",
  comprador: "Comprador",
  inquilino: "Inquilino",
  imovel: "Imóvel",
  morada: "Morada",
  preco: "Preço",
  renda: "Renda",
  prazo: "Prazo",
  data: "Data",
};

export function variableLabel(name: string): string {
  return VARIABLE_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
