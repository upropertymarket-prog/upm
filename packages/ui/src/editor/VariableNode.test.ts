import { describe, expect, it } from "vitest";

import { Variable } from "./VariableNode";

/**
 * O contrato da marcação do chip, testado dos dois lados
 * =========================================================================
 * O editor **escreve** `<span data-variable="nome" data-label="Nome"
 * class="upm-chip">Nome</span>`; o servidor **lê** essa marcação para
 * substituir a variável pelo valor do destinatário
 * (`substituteCampaignVariables`, em `packages/db/src/campaign-blocks.ts`, com
 * os seus próprios testes).
 *
 * Os dois lados não se podem importar — `@upm/ui` não depende de `@upm/db` nem
 * o contrário, e é bom que assim seja. O que os liga é esta marcação, e o que
 * a protege são estes testes: renomear `data-variable` aqui faz passar a ser
 * texto normal lá, **sem erro nenhum** — a campanha sairia com "Nome" para toda
 * a gente em vez do nome de cada um.
 *
 * É também a marcação que os contratos já escrevem desde a Fase 6, o que torna
 * a convergência de D68 uma troca de ficheiro e não uma migração de conteúdo.
 */

type RenderOutput = [string, Record<string, unknown>, string];

/** Chama o `renderHTML` do nó como o TipTap o chamaria. */
function renderChip(name: string, label: string): RenderOutput {
  const render = Variable.config.renderHTML as (props: {
    HTMLAttributes: Record<string, unknown>;
    node: { attrs: Record<string, unknown> };
  }) => RenderOutput;

  return render({
    HTMLAttributes: { "data-variable": name, "data-label": label },
    node: { attrs: { name, label } },
  });
}

describe("Variable (o chip)", () => {
  it("escreve um `span` com `data-variable` e a classe `upm-chip`", () => {
    const [tag, attrs, text] = renderChip("nome", "Nome");
    expect(tag).toBe("span");
    expect(attrs["data-variable"]).toBe("nome");
    expect(attrs.class).toBe("upm-chip");
    expect(text).toBe("Nome");
  });

  it("o que sai casa com o que o servidor substitui", () => {
    const [tag, attrs, text] = renderChip("plano", "Plano");
    const html = `<span data-variable="${attrs["data-variable"]}" class="${attrs.class}">${text}</span>`;

    // A mesma expressão de `substituteCampaignVariables`. Está repetida aqui de
    // propósito: é o teste que falha se um dos lados mudar sem o outro.
    const pattern = /<span[^>]*data-variable="([a-z]+)"[^>]*>(.*?)<\/span>/i;
    const match = html.match(pattern);

    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("plano");
    expect(match?.[2]).toBe("Plano");
    expect(tag).toBe("span");
  });

  it("sem rótulo cai para o nome — nunca sai um chip vazio", () => {
    const render = Variable.config.renderHTML as (props: {
      HTMLAttributes: Record<string, unknown>;
      node: { attrs: Record<string, unknown> };
    }) => RenderOutput;

    const [, , text] = render({
      HTMLAttributes: { "data-variable": "apelido" },
      node: { attrs: { name: "apelido", label: "" } },
    });
    expect(text).toBe("apelido");
  });

  it("é inline e atom — apaga-se inteiro, não meia variável", () => {
    expect(Variable.config.inline).toBe(true);
    expect(Variable.config.atom).toBe(true);
    expect(Variable.config.group).toBe("inline");
  });

  it("reconhece a sua própria marcação ao reabrir", () => {
    // Sem isto, reabrir uma campanha guardada transformava os chips em texto.
    const parse = Variable.config.parseHTML as () => { tag: string }[];
    expect(parse()[0]?.tag).toBe("span[data-variable]");
  });

  it("a versão em texto é o rótulo, que é o que um e-mail sem HTML mostra", () => {
    const renderText = Variable.config.renderText as (props: {
      node: { attrs: Record<string, unknown> };
    }) => string;
    expect(renderText({ node: { attrs: { name: "nome", label: "Nome" } } })).toBe("Nome");
  });
});
