import { Node, mergeAttributes } from "@tiptap/core";

/**
 * A variável como nó — o chip (P10-08 · 04 §2.6)
 * =========================================================================
 * Inline e **atom**: não se escreve dentro de uma variável, apaga-se inteira. É
 * o que faz dela um campo e não uma palavra — meio "Nom" não é nada.
 *
 * ## A marcação é a mesma dos contratos, e isso não é coincidência
 *
 * `<span data-variable="nome">Nome</span>`, com a classe `upm-chip`. Os
 * contratos têm o seu próprio nó desde a Fase 6 (`VariableNode.ts` em
 * `apps/app`) e escrevem **exatamente** esta marcação. Escolhi repeti-la em vez
 * de inventar outra por uma razão prática: quando D68 convergir os dois
 * editores de contratos para aqui, o que está guardado continua a ler-se sem
 * migração de conteúdo.
 *
 * A diferença entre os dois é só o que sabem: o dos contratos conhece a lista
 * de variáveis de contrato (`variableLabel` de `contractTypes`); este **não
 * conhece lista nenhuma** — recebe-a de quem o monta. É o que o torna comum às
 * campanhas (`{nome} {apelido} {plano}`) e, amanhã, aos contratos.
 *
 * ## Porque é que a substituição não vive aqui
 *
 * O envio de uma campanha corre no servidor e não pode carregar o TipTap para
 * trocar três palavras. A substituição é uma função pura sobre o HTML, em
 * `@upm/db/campaigns` (`substituteCampaignVariables`), e o contrato entre as
 * duas é esta marcação — que está fixada por testes dos dois lados.
 */

export type EditorVariable = { name: string; label: string };

export const Variable = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      name: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-variable") ?? "",
        renderHTML: (attributes) => ({ "data-variable": attributes.name as string }),
      },
      label: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-label") ?? "",
        renderHTML: (attributes) => ({ "data-label": attributes.label as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-variable]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    // O rótulo é o que se lê no chip **e** o que a substituição deixa quando
    // não há valor (ver `substituteCampaignVariables`). Sem rótulo cai para o
    // nome, para nunca sair um chip vazio.
    const label = String(node.attrs.label ?? "") || String(node.attrs.name ?? "");
    return ["span", mergeAttributes(HTMLAttributes, { class: "upm-chip" }), label];
  },

  renderText({ node }) {
    return String(node.attrs.label ?? "") || String(node.attrs.name ?? "");
  },
});
