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
 *
 * Os rótulos estão em `editor.variables.*`, **as mesmas chaves que o editor de
 * modelos do Admin usa**: é a mesma variável do mesmo contrato vista dos dois
 * lados, e dois sítios a traduzir "Proprietário" por sua conta é garantir que
 * um dia divergem. Aqui fica só a lista de quais têm rótulo — o administrador
 * pode escrever qualquer nome no modelo, e `t()` de uma chave que não existe
 * imprime a chave.
 */
export const VARIAVEIS_COM_ROTULO = new Set([
  "proprietario",
  "comprador",
  "inquilino",
  "imovel",
  "morada",
  "preco",
  "renda",
  "prazo",
  "data",
]);

/** Sem rótulo conhecido, o nome com a primeira letra em maiúscula. */
export function nomeEmRotulo(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * `variableLabel` com o tradutor de `editor.variables` à cabeça. Recebe-se a
 * função em vez de se chamar o hook aqui porque este ficheiro é de modelos de
 * vista e corre nos dois lados.
 */
export function variableLabel(name: string, t: (key: string) => string): string {
  return VARIAVEIS_COM_ROTULO.has(name) ? t(name) : nomeEmRotulo(name);
}

/**
 * Data e hora na etiqueta `Intl` do idioma escolhido (02 §12). O `locale` é
 * argumento e não constante — ver a mesma nota em `cloud/cloudTypes.ts`.
 */
export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
