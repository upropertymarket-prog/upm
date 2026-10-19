import { Node, mergeAttributes } from "@tiptap/core";

import { nomeEmRotulo } from "./contractTypes";

/**
 * O nó `variable` — a variável do contrato, 04 §8.3
 * =========================================================================
 * Inline e **atom**: não se escreve dentro de uma variável, apaga-se inteira. É
 * o que faz dela um campo e não uma palavra — meio "Proprietár" não é nada.
 *
 * Guarda `name` (a chave, `proprietario`) e `label` (o que se lê,
 * "Proprietário"). O `name` é o que casa com `contracts.values` e com
 * `contract_templates.variables`; o `label` é só apresentação e é recalculado a
 * partir do `name` quando faltar, para um modelo antigo nunca mostrar uma
 * variável vazia.
 *
 * O rótulo de recurso **não se traduz**: o que conta é o `label` que ficou
 * guardado no documento quando a variável foi inserida, e um contrato
 * partilhado ou assinado não muda de palavras por alguém trocar o idioma. Sem
 * `label` guardado — um modelo antigo —, mostra-se o `name` com maiúscula.
 *
 * Na pré-visualização a variável dá lugar ao valor (04 §8.3 — "substituídas em
 * pré-visualização"); só fica à vista a que ninguém preencheu.
 */
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
    const name = String(node.attrs.name ?? "");
    const label = String(node.attrs.label ?? "") || nomeEmRotulo(name);
    return ["span", mergeAttributes(HTMLAttributes, { class: "upm-chip" }), label];
  },

  renderText({ node }) {
    const name = String(node.attrs.name ?? "");
    return String(node.attrs.label ?? "") || nomeEmRotulo(name);
  },
});

type DocNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
};

/**
 * Troca cada variável pelo valor que o utilizador escreveu. Uma variável por
 * preencher fica à vista como está no editor — roxa, por entre o texto preto —
 * em vez de deixar um buraco: um contrato com um espaço em branco onde devia
 * estar o preço é pior do que um contrato que diz, à frente de quem o lê, que
 * falta ali o preço.
 */
export function substituteVariables(doc: unknown, values: Record<string, string>): unknown {
  function walk(node: DocNode): DocNode {
    if (node.type === "variable") {
      const name = String(node.attrs?.name ?? "");
      const value = values[name]?.trim();
      return value && value.length > 0 ? { type: "text", text: value } : node;
    }
    if (Array.isArray(node.content)) {
      return { ...node, content: node.content.map(walk) };
    }
    return node;
  }

  return walk((doc ?? { type: "doc", content: [] }) as DocNode);
}

/** As variáveis que o documento usa de facto — a ordem é a de leitura. */
export function variablesInDoc(doc: unknown): string[] {
  const found: string[] = [];
  function walk(node: DocNode) {
    if (node.type === "variable") {
      const name = String(node.attrs?.name ?? "");
      if (name && !found.includes(name)) found.push(name);
    }
    node.content?.forEach(walk);
  }
  walk((doc ?? {}) as DocNode);
  return found;
}
