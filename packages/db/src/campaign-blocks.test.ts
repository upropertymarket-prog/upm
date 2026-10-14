import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_BLOCK_TYPES,
  CAMPAIGN_VARIABLES,
  campaignBlockSchema,
  campaignBlocksSchema,
  campaignVariablesIn,
  substituteCampaignVariables,
  type CampaignBlock,
} from "./campaign-blocks";

/**
 * O contrato do JSON dos blocos é lido pelo construtor, pelo renderizador, pela
 * pré-visualização e pelo envio. Um erro aqui não dá erro: dá um e-mail que sai
 * diferente do que se viu no ecrã — e sai para milhares de pessoas de uma vez.
 */

const footer: CampaignBlock = {
  id: "f",
  type: "footer",
  align: "center",
  text: "Recebeu este e-mail porque subscreveu as novidades.",
};

describe("campaignBlocksSchema", () => {
  it("exige o rodapé — é o link de cancelar subscrição do RGPD", () => {
    const sem = campaignBlocksSchema.safeParse([
      { id: "h", type: "heading", align: "left", text: "Olá", level: 1 },
    ]);
    expect(sem.success).toBe(false);
    expect(sem.error?.issues[0]?.message).toContain("cancelar subscrição");

    const com = campaignBlocksSchema.safeParse([
      { id: "h", type: "heading", align: "left", text: "Olá", level: 1 },
      footer,
    ]);
    expect(com.success).toBe(true);
  });

  it("recusa dois blocos com o mesmo id — o duplicar passaria a mexer nos dois", () => {
    const result = campaignBlocksSchema.safeParse([
      { id: "x", type: "divider" },
      { id: "x", type: "divider" },
      footer,
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("mesmo identificador");
  });

  it("recusa uma lista vazia", () => {
    expect(campaignBlocksSchema.safeParse([]).success).toBe(false);
  });

  it("os dez tipos de 04 §2.6, e só estes", () => {
    expect(CAMPAIGN_BLOCK_TYPES).toHaveLength(10);
    // Não há bloco de HTML livre, de propósito: era a porta por onde entrava
    // marcação que nenhum cliente de e-mail desenha.
    expect(CAMPAIGN_BLOCK_TYPES).not.toContain("html");
  });
});

describe("campaignBlockSchema", () => {
  it("o divisor e o espaçador não têm alinhamento (04 §2.6)", () => {
    const divider = campaignBlockSchema.parse({ id: "d", type: "divider" });
    expect(divider).not.toHaveProperty("align");

    const spacer = campaignBlockSchema.parse({ id: "s", type: "spacer" });
    expect(spacer).not.toHaveProperty("align");
    expect(spacer).toMatchObject({ height: 24 });
  });

  it("alinha por omissão à esquerda", () => {
    const block = campaignBlockSchema.parse({ id: "t", type: "text" });
    expect(block).toMatchObject({ align: "left" });
  });

  it("a imagem aceita `href` vazio mas não um URL inválido", () => {
    expect(campaignBlockSchema.safeParse({ id: "i", type: "image", href: "" }).success).toBe(true);
    expect(campaignBlockSchema.safeParse({ id: "i", type: "image", href: "nao-url" }).success).toBe(
      false,
    );
  });

  it("o espaçador fica entre 4 e 96 px — fora disso é um bloco invisível ou um ecrã em branco", () => {
    expect(campaignBlockSchema.safeParse({ id: "s", type: "spacer", height: 2 }).success).toBe(
      false,
    );
    expect(campaignBlockSchema.safeParse({ id: "s", type: "spacer", height: 200 }).success).toBe(
      false,
    );
  });

  it("a assinatura aponta para uma caixa e não traz HTML próprio (07 §24.6 #3)", () => {
    const block = campaignBlockSchema.parse({ id: "a", type: "signature" });
    expect(block).not.toHaveProperty("html");
    expect(block).toMatchObject({ mailboxId: null });
  });
});

describe("substituteCampaignVariables", () => {
  const html = '<p>Olá <span data-variable="nome">Nome</span>, o seu plano é ';

  it("troca o chip pelo valor", () => {
    expect(substituteCampaignVariables(`${html}</p>`, { nome: "Ana" })).toBe(
      "<p>Olá Ana, o seu plano é </p>",
    );
  });

  it("sem valor, deixa o rótulo à vista em vez de o apagar", () => {
    // "Olá ," parece um defeito do produto; "Olá Nome," denuncia-se a quem o
    // escreveu, que é quem o pode corrigir.
    expect(substituteCampaignVariables(`${html}</p>`, {})).toBe("<p>Olá Nome, o seu plano é </p>");
  });

  it("escapa o valor — o nome é texto que o utilizador escreveu", () => {
    const out = substituteCampaignVariables('<span data-variable="nome">Nome</span>', {
      nome: "<script>alert(1)</script>",
    });
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("troca várias ocorrências do mesmo chip", () => {
    const repetido =
      '<p><span data-variable="nome">Nome</span> e <span data-variable="nome">Nome</span></p>';
    expect(substituteCampaignVariables(repetido, { nome: "Ana" })).toBe("<p>Ana e Ana</p>");
  });

  it("não mexe num `span` que não é variável", () => {
    const outro = '<p><span style="color:red">vermelho</span></p>';
    expect(substituteCampaignVariables(outro, { nome: "Ana" })).toBe(outro);
  });
});

describe("campaignVariablesIn", () => {
  it("diz quais usa, sem repetir", () => {
    const html =
      '<span data-variable="nome">N</span><span data-variable="plano">P</span><span data-variable="nome">N</span>';
    expect(campaignVariablesIn(html).sort()).toEqual(["nome", "plano"]);
  });

  it("ignora o que não é uma das três", () => {
    expect(campaignVariablesIn('<span data-variable="morada">M</span>')).toEqual([]);
  });

  it("as três de 04 §2.6", () => {
    expect(CAMPAIGN_VARIABLES).toEqual(["nome", "apelido", "plano"]);
  });
});
