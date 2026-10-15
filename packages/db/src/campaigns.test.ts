import { describe, expect, it } from "vitest";

import {
  campaignBlockFindings,
  campaignEmailSaveSchema,
  campaignSaveSchema,
  delayInDays,
  parseCampaignBlocks,
  sanitizeCampaignBlocks,
  sanitizeCampaignHtml,
} from "./campaigns";
import {
  createCampaignBlock,
  defaultCampaignBlocks,
  substituteCampaignVariables,
  type CampaignBlock,
} from "./campaign-blocks";

/**
 * As campanhas, do lado do Node (P10-08)
 * =========================================================================
 * O que estes testes fixam é o contrato que **não se vê**: que o chip da
 * variável sobrevive ao sanitizador, que o rodapé é obrigatório, e que um
 * e-mail acabado de criar — sem blocos nenhuns — é um estado aceite.
 */

function textBlock(html: string): CampaignBlock {
  return { ...createCampaignBlock("text"), html } as CampaignBlock;
}

describe("sanitização dos blocos", () => {
  it("o chip da variável sobrevive inteiro — é o contrato com o editor", () => {
    const html =
      '<p>Olá <span data-variable="nome" data-label="Nome" class="upm-chip">Nome</span>,</p>';
    const clean = sanitizeCampaignHtml(html);

    expect(clean).toContain('data-variable="nome"');
    expect(clean).toContain('data-label="Nome"');
    // E, o que importa de verdade: a substituição continua a encontrá-lo.
    expect(substituteCampaignVariables(clean, { nome: "Ana" })).toContain("Olá Ana");
  });

  it("sem valor, o chip deixa o rótulo à vista em vez de desaparecer", () => {
    const clean = sanitizeCampaignHtml('<p><span data-variable="plano">Plano</span></p>');
    expect(substituteCampaignVariables(clean, {})).toContain("Plano");
  });

  it("o alinhamento do texto passa; qualquer outro estilo não", () => {
    const clean = sanitizeCampaignHtml(
      '<p style="text-align:center;position:fixed;color:red">Oi</p>',
    );
    expect(clean).toContain("text-align:center");
    expect(clean).not.toContain("position");
    expect(clean).not.toContain("color");
  });

  it("o script, o iframe e os `on…=` saem, e o conteúdo do script não fica como texto", () => {
    const clean = sanitizeCampaignHtml(
      '<p onclick="roubar()">Oi</p><script>alert("x")</script><iframe src="https://x"></iframe>',
    );
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("alert");
    expect(clean).not.toContain("<iframe");
  });

  it("uma ligação sai sempre para fora e sem referrer", () => {
    const clean = sanitizeCampaignHtml('<p><a href="https://upm.pt">Ver</a></p>');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it("`javascript:` numa ligação não passa", () => {
    expect(sanitizeCampaignHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript");
  });

  it("só o bloco de texto é sanitizado — o resto é texto simples", () => {
    const heading = { ...createCampaignBlock("heading"), text: "Casas & Jardins" } as CampaignBlock;
    const [limpo] = sanitizeCampaignBlocks([heading]);

    // Passá-lo pelo sanitizador transformava o `&` num `&amp;` visível.
    expect(limpo).toEqual(heading);
  });

  it("o relatório diz o que foi retirado, para o ecrã o poder dizer", () => {
    const achados = campaignBlockFindings([textBlock('<p onclick="x()">Oi</p><script>y</script>')]);
    expect(achados).toContain("<script>");
    expect(achados).toContain("onclick=");
  });
});

describe("o `interval` como dias", () => {
  it.each([
    ["3 days", 3],
    ["1 day", 1],
    ["3 days 02:00:00", 3],
    ["00:00:00", 0],
    [null, 0],
    [undefined, 0],
    ["", 0],
  ])("%s → %i", (interval, dias) => {
    expect(delayInDays(interval as string | null | undefined)).toBe(dias);
  });
});

describe("os blocos guardados", () => {
  it("um e-mail acabado de criar não tem blocos, e isso é um estado válido", () => {
    expect(parseCampaignBlocks([])).toEqual([]);
  });

  it("o que não passa o contrato lê-se como vazio em vez de rebentar o construtor", () => {
    expect(parseCampaignBlocks([{ type: "inexistente" }])).toEqual([]);
    expect(parseCampaignBlocks(null)).toEqual([]);
    expect(parseCampaignBlocks("não é uma lista")).toEqual([]);
  });

  it("os blocos por omissão trazem o rodapé e passam o contrato", () => {
    const blocos = defaultCampaignBlocks();
    expect(blocos.some((bloco) => bloco.type === "footer")).toBe(true);
    expect(parseCampaignBlocks(blocos)).toHaveLength(blocos.length);
  });

  it("os `id` dos blocos por omissão são todos diferentes", () => {
    const ids = defaultCampaignBlocks().map((bloco) => bloco.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("os esquemas das escritas", () => {
  it("a campanha precisa de nome", () => {
    expect(campaignSaveSchema.safeParse({ name: "  " }).success).toBe(false);
  });

  it("o fundo tem de ser hexadecimal — um token não serve num cliente de e-mail", () => {
    expect(campaignSaveSchema.safeParse({ name: "Outono", emailBg: "var(--bg)" }).success).toBe(
      false,
    );
    expect(campaignSaveSchema.safeParse({ name: "Outono", emailBg: "#ff6a00" }).success).toBe(true);
  });

  const campaignId = "11111111-1111-4111-8111-111111111111";

  it("um e-mail vazio grava-se; um com blocos sem rodapé não", () => {
    expect(campaignEmailSaveSchema.safeParse({ campaignId, blocks: [] }).success).toBe(true);

    expect(
      campaignEmailSaveSchema.safeParse({
        campaignId,
        blocks: [createCampaignBlock("heading")],
      }).success,
    ).toBe(false);

    expect(
      campaignEmailSaveSchema.safeParse({ campaignId, blocks: defaultCampaignBlocks() }).success,
    ).toBe(true);
  });

  it("a espera é em dias inteiros e não negativa", () => {
    const base = { campaignId, blocks: [] };
    expect(campaignEmailSaveSchema.safeParse({ ...base, delayDays: -1 }).success).toBe(false);
    expect(campaignEmailSaveSchema.safeParse({ ...base, delayDays: 1.5 }).success).toBe(false);
    expect(campaignEmailSaveSchema.safeParse({ ...base, delayDays: 3 }).success).toBe(true);
  });
});
