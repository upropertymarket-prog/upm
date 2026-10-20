import type { Notification } from "@upm/ui";

/**
 * Dados fixos do ecrã de verificação da Fase 1 (`apps/app/src/app/page.tsx`)
 * =========================================================================
 * Esta pessoa não existe, estes contadores não vêm de lado nenhum e estas duas
 * notificações nunca foram enviadas. Era por isso que estavam a ser contadas
 * como texto por traduzir (D72) quando não são texto do produto: são o
 * equivalente a uma fixture, a viver dentro de uma rota.
 *
 * Mudaram-se para uma pasta `demo-data/`, que o `scripts/gate/check-i18n.mjs`
 * ignora por estrutura, pela mesma razão que o `ComponentsPreview` está isento:
 * **esta rota desaparece quando o Painel do comprador nascer** (04 §8.2), e
 * traduzir dados de exemplo de um ecrã marcado para sair é trabalho que se
 * deita fora. A pasta fica em `src/lib/` e não em `src/app/` de propósito —
 * debaixo de `app/` tornava-se um segmento de rota.
 *
 * O dia em que o Painel nascer, este ficheiro vai com ele.
 */
export const DEMO_OWNER_NAME = "Ana";
export const DEMO_OWNER_FULL_NAME = "Ana Silva";
export const DEMO_OWNER_META = "Proprietária · Premium";

export const DEMO_OWNER_COUNTERS = {
  leads: 9,
  messages: 3,
  visitSchedule: 3,
  contracts: 1,
};

export const DEMO_OWNER_NOTIFICATIONS: Notification[] = [
  { id: "n1", text: "João Costa pediu uma visita ao UPM-1041", when: "há 2 h", read: false },
  { id: "n2", text: "O UPM-1047 foi aprovado pela moderação", when: "ontem", read: true },
];
