import { Node, mergeAttributes } from "@tiptap/core";

import { variableLabel } from "./contractTypes";

/**
 * O nó `variable` — a "variável em chip" de 04 §8.3
 * =========================================================================
 * Inline e **atom**: não se escreve dentro de um chip, apaga-se inteiro. É o
 * que faz dele um campo e não uma palavra — meio `[ Proprietár` não é nada.
 *
 * Guarda `name` (a chave, `proprietario`) e `label` (o que se lê,
 * "Proprietário"). O `name` é o que casa com `contracts.values` e com
 * `contract_templates.variables`; o `label` é só apresentação e é recalculado a
 * partir do `name` quando faltar, para um modelo antigo nunca mostrar um chip
 * vazio.
 *
 * Na pré-visualização o chip não aparece: `substituteVariables` troca-o pelo
 * valor (04 §8.3 — "substituídas em pré-visualização").
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
    const label = String(node.attrs.label ?? "") || variableLabel(name);
    return ["span", mergeAttributes(HTMLAttributes, { class: "upm-chip" }), `[ ${label} ]`];
  },

  renderText({ node }) {
    const name = String(node.attrs.name ?? "");
    return `[ ${String(node.attrs.label ?? "") || variableLabel(name)} ]`;
  },
});

type DocNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
};

/**
 * Troca cada chip pelo valor que o utilizador escreveu. Uma variável por
 * preencher fica com o chip à vista, em vez de deixar um buraco: um contrato
 * com um espaço em branco onde devia estar o preço é pior do que um contrato
 * que diz, à frente de quem o lê, que falta ali o preço.
 */
export function substituteVariables(doc: unknown, values: Record<string, string>): unknown {
  function walk(node: DocNode): DocNode {
    if (node.type === "variable") {
      const name = String(node.attrs?.name ?? "");
      const label = String(node.attrs?.label ?? "") || variableLabel(name);
      const value = values[name]?.trim();
      return { type: "text", text: value && value.length > 0 ? value : `[ ${label} ]` };
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
